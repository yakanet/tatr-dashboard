/**
 * Loads a repository's tasks: list once, then read the task files in parallel.
 *
 * Only the listing can be rate-limited, so providers are tried in order —
 * GitHub, then ungh, then jsDelivr — and the result reports which one answered
 * and whether it may be stale. Contents always come from raw.githubusercontent,
 * which imposes no budget.
 *
 * A loaded repository is cached and never expires on its own: quota is only ever
 * spent on a first visit or on an explicit refresh, so the reader decides when
 * to pay for fresh data. {@link LoadResult.storedAt} carries the age so the UI
 * can show it next to that refresh control.
 *
 * Only metadata is cached — descriptions are more than half the bytes and are
 * cheap to re-read, since raw.githubusercontent costs no quota. What the graph
 * needs from those descriptions, the referenced task ids, is extracted at parse
 * time and kept, so dropping the prose costs no feature.
 */
import { collectAttachments } from '../tatr/attachments.ts';
import { readTask, type Task } from '../tatr/task.ts';
import { parseTaskMd } from '../tatr/task-md.ts';
import { parseTagsFile, type TagDescriptions } from '../tatr/tags-file.ts';
import { isValidHuid } from '../tatr/huid.ts';
import { repoKey, type RepoRef } from '../repo/ref.ts';
import { github, rawUrl } from './github.ts';
import { jsdelivr } from './jsdelivr.ts';
import { ungh } from './ungh.ts';
import { openStore, type RepoStore } from './store.ts';
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
	/** Where to cache; defaults to IndexedDB, falling back to memory. */
	store?: RepoStore;
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

/** What is cached: no descriptions, and none of the fields describing this retrieval. */
type CachedLoad = Omit<LoadResult, 'fromCache' | 'storedAt'>;

/** Strips the bodies before storing. References were extracted at parse time. */
function withoutDescriptions(tasks: Task[]): Task[] {
	return tasks.map(({ description: _description, ...rest }) => rest);
}

export async function loadRepository(ref: RepoRef, options: LoadOptions = {}): Promise<LoadResult> {
	const key = repoKey(ref);
	const store = options.store ?? openStore();

	if (!options.refresh) {
		const cached = await store.read<CachedLoad>(key);
		// IndexedDB stores structured clones, so Date and Map come back intact.
		if (cached) return { ...cached.value, fromCache: true, storedAt: cached.storedAt };
	}

	const doFetch = options.fetchImpl ?? fetch;
	const listing = await listRepository(ref, options);

	const taskFiles = listing.entries.filter((entry) => /^tasks\/[^/]+\/TASK\.md$/.test(entry.path));
	// Free: the whole tree came down in the listing request, and these are the
	// entries that were being discarded.
	const attachments = collectAttachments(listing.entries);
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
		const carried = attachments.get(id);
		tasks.push(carried ? { ...task, attachments: carried } : task);
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
		tags,
		source: listing.source,
		mayBeStale: listing.mayBeStale,
		branch: listing.branch
	};
	await store.write(key, { ...payload, tasks: withoutDescriptions(tasks) }, storedAt);

	// The caller gets the bodies it just paid for; only the cache goes without.
	return { ...payload, fromCache: false, storedAt };
}

/**
 * Reads one task's body on demand, for the detail view. Free of the API budget,
 * and roughly 30 ms, so it is cheaper to re-read than to keep every description
 * in storage.
 */
export async function loadTaskDescription(
	ref: RepoRef,
	branch: string,
	id: string,
	options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}
): Promise<string | null> {
	const doFetch = options.fetchImpl ?? fetch;
	try {
		const response = await doFetch(rawUrl(ref, branch, `tasks/${id}/TASK.md`), {
			signal: options.signal
		});
		if (!response.ok) return null;
		return parseTaskMd(await response.text()).description;
	} catch {
		return null;
	}
}
