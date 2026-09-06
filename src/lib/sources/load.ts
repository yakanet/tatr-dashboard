/**
 * Loads a repository's tasks: list once, then read the task files in parallel.
 *
 * Only the listing can be rate-limited, so providers are tried in order —
 * GitHub, then ungh, then jsDelivr — and the result reports which one answered
 * and whether it may be stale. Contents always come from raw.githubusercontent,
 * which imposes no budget.
 *
 * A loaded repository is cached whole and never expires on its own: quota is
 * only ever spent on a first visit or on an explicit refresh, so the reader
 * decides when to pay for fresh data. {@link LoadResult.storedAt} carries the
 * age so the UI can show it next to that refresh control.
 */
import { readTask, type Task } from '../tatr/task.ts';
import { parseTagsFile, type TagDescriptions } from '../tatr/tags-file.ts';
import { isValidHuid } from '../tatr/huid.ts';
import { repoKey, type RepoRef } from '../repo/ref.ts';
import { github, rawUrl } from './github.ts';
import { jsdelivr } from './jsdelivr.ts';
import { ungh } from './ungh.ts';
import { readCache, writeCache, type CacheStorage } from './cache.ts';
import { ProviderError, type Listing, type Provider } from './provider.ts';

/** Tried in order. GitHub first so the normal path depends on nobody else. */
export const PROVIDERS: Provider[] = [github, ungh, jsdelivr];

export interface LoadOptions {
	providers?: Provider[];
	/** Parallel reads. Polite to the CDN while still finishing in well under a second. */
	concurrency?: number;
	signal?: AbortSignal;
	/** Called as task files arrive, for progressive rendering. */
	onProgress?: (done: number, total: number) => void;
	fetchImpl?: typeof fetch;
	/** Ignore any cached copy and fetch again. This is what the refresh control does. */
	refresh?: boolean;
	/** Storage for the cache; defaults to localStorage, absent in non-browser contexts. */
	storage?: CacheStorage | null;
	now?: () => number;
}

export interface LoadResult {
	tasks: Task[];
	/** Files under `tasks/` that could not be parsed, listed rather than dropped. */
	skipped: { id: string; reason: string }[];
	tags: TagDescriptions;
	/** Which provider listed the repository. */
	source: string;
	mayBeStale: boolean;
	fromCache: boolean;
	/** When this view of the repository was fetched, in epoch milliseconds. */
	storedAt: number;
	branch: string;
}

export class NoTasksFolderError extends Error {
	constructor(ref: RepoRef) {
		super(`${ref.owner}/${ref.name} has no tasks/ folder at its root`);
		this.name = 'NoTasksFolderError';
	}
}

/** Lists a repository, falling back through the providers in order. */
export async function listRepository(ref: RepoRef, options: LoadOptions = {}): Promise<Listing> {
	const providers = options.providers ?? PROVIDERS;
	let lastError: unknown;

	for (const provider of providers) {
		try {
			return await provider.list(ref, options.signal);
		} catch (error) {
			// A missing repository is the same everywhere; do not ask the others.
			if (error instanceof ProviderError && error.failure === 'not-found') throw error;
			lastError = error;
		}
	}
	throw lastError ?? new Error('No provider could list the repository');
}

/** Runs `worker` over `items` with a bounded number in flight. */
async function pooled<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length);
	let next = 0;

	const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
		for (;;) {
			const index = next++;
			if (index >= items.length) return;
			results[index] = await worker(items[index]);
		}
	});

	await Promise.all(runners);
	return results;
}

/** A cached load, minus the fields that describe this particular retrieval. */
type CachedLoad = Omit<LoadResult, 'fromCache' | 'storedAt' | 'tags'> & {
	tagDescriptions: [string, string][];
	redefinedTags: string[];
};

export async function loadRepository(ref: RepoRef, options: LoadOptions = {}): Promise<LoadResult> {
	const key = repoKey(ref);
	const storage = options.storage === undefined ? undefined : options.storage;

	if (!options.refresh) {
		const cached =
			storage === undefined ? readCache<CachedLoad>(key) : readCache<CachedLoad>(key, storage);
		if (cached) {
			return {
				...cached.value,
				// Dates do not survive JSON, so rebuild them.
				tasks: cached.value.tasks.map((task) => ({ ...task, created: new Date(task.created) })),
				tags: {
					descriptions: new Map(cached.value.tagDescriptions),
					redefined: cached.value.redefinedTags
				},
				fromCache: true,
				storedAt: cached.storedAt
			};
		}
	}

	const doFetch = options.fetchImpl ?? fetch;
	const listing = await listRepository(ref, options);

	const taskFiles = listing.entries.filter((entry) => /^tasks\/[^/]+\/TASK\.md$/.test(entry.path));
	const hasTasksFolder = listing.entries.some((entry) => entry.path.startsWith('tasks/'));
	if (!hasTasksFolder) throw new NoTasksFolderError(ref);

	const read = async (path: string): Promise<string | null> => {
		try {
			const response = await doFetch(rawUrl(ref, listing.branch, path), { signal: options.signal });
			return response.ok ? await response.text() : null;
		} catch {
			return null;
		}
	};

	let done = 0;
	const contents = await pooled(taskFiles, options.concurrency ?? 12, async (entry) => {
		const text = await read(entry.path);
		options.onProgress?.(++done, taskFiles.length);
		return { path: entry.path, text };
	});

	const tasks: Task[] = [];
	const skipped: { id: string; reason: string }[] = [];

	for (const { path, text } of contents) {
		const id = path.split('/')[1];
		if (!isValidHuid(id)) {
			skipped.push({ id, reason: 'Folder name is not a task id' });
			continue;
		}
		if (text === null) {
			skipped.push({ id, reason: 'Could not be read' });
			continue;
		}
		const task = readTask(id, text);
		if (!task) {
			skipped.push({ id, reason: 'Could not be parsed' });
			continue;
		}
		tasks.push(task);
	}

	// Tag descriptions are optional, and their absence is not an error.
	const tagsFile = listing.entries.some((entry) => entry.path === 'tasks/tags')
		? await read('tasks/tags')
		: null;
	const tags = parseTagsFile(tagsFile ?? '');

	const storedAt = options.now?.() ?? Date.now();
	const payload: CachedLoad = {
		tasks,
		skipped,
		source: listing.source,
		mayBeStale: listing.mayBeStale,
		branch: listing.branch,
		tagDescriptions: [...tags.descriptions],
		redefinedTags: tags.redefined
	};
	if (storage === undefined) writeCache(key, payload, storedAt);
	else writeCache(key, payload, storedAt, storage);

	return { ...payload, tags, fromCache: false, storedAt };
}
