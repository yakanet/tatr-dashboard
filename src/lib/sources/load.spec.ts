import { beforeEach, describe, expect, it, vi } from 'vitest';
import rawTasks from '../../../tests/fixtures/tsoding-tatr-raw.json' with { type: 'json' };
import { parseRepoPath } from '../repo/ref.ts';
import { memoryStore } from './store.ts';
import { NoTasksFolderError, loadRepository, listRepository } from './load.ts';
import { ProviderError, type Listing, type Provider } from './provider.ts';

const sources = rawTasks as Record<string, string>;
const ref = parseRepoPath('tsoding/tatr')!;

/** A provider that answers from the embedded fixture. */
function fakeProvider(name: string, overrides: Partial<Listing> = {}): Provider {
	return {
		name,
		list: async () => ({
			entries: [
				...Object.keys(sources).map((id) => ({ path: `tasks/${id}/TASK.md`, size: 1 })),
				{ path: 'tasks/tags' },
				{ path: 'README.md' }
			],
			source: name,
			mayBeStale: false,
			branch: 'HEAD',
			...overrides
		})
	};
}

const failing = (name: string, failure: 'rate-limited' | 'not-found' | 'network'): Provider => ({
	name,
	list: async () => {
		throw new ProviderError(failure, name, failure);
	}
});

/** Serves task files, and the tags file, from the fixture. */
const fetchFixture = vi.fn(async (input: RequestInfo | URL) => {
	const url = String(input);
	const match = /tasks\/([^/]+)\/TASK\.md$/.exec(url);
	if (match && sources[match[1]]) {
		return new Response(sources[match[1]], { status: 200 });
	}
	if (url.endsWith('tasks/tags')) {
		return new Response('bug , unintended behavior\nrelease , planned for the next release\n', {
			status: 200
		});
	}
	return new Response('not found', { status: 404 });
}) as unknown as typeof fetch;

let store = memoryStore();

beforeEach(() => {
	store = memoryStore();
	vi.clearAllMocks();
});

describe('provider fallback', () => {
	it('uses the first provider that answers', async () => {
		const listing = await listRepository(ref, { providers: [fakeProvider('github')] });
		expect(listing.source).toBe('github');
	});

	it('falls through when the budget is spent', async () => {
		const listing = await listRepository(ref, {
			providers: [failing('github', 'rate-limited'), fakeProvider('ungh')]
		});
		expect(listing.source).toBe('ungh');
	});

	it('does not ask the others when the repository does not exist', async () => {
		const second = fakeProvider('ungh');
		const spy = vi.spyOn(second, 'list');
		await expect(
			listRepository(ref, { providers: [failing('github', 'not-found'), second] })
		).rejects.toThrow(ProviderError);
		expect(spy).not.toHaveBeenCalled();
	});

	it('reports staleness so the UI can say so', async () => {
		const listing = await listRepository(ref, {
			providers: [fakeProvider('jsdelivr', { mayBeStale: true })]
		});
		expect(listing.mayBeStale).toBe(true);
	});

	it('rethrows when every provider fails', async () => {
		await expect(
			listRepository(ref, {
				providers: [failing('github', 'rate-limited'), failing('ungh', 'network')]
			})
		).rejects.toThrow(ProviderError);
	});
});

describe('loadRepository', () => {
	it('reads every task in the repository', async () => {
		const result = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store
		});
		expect(result.tasks).toHaveLength(64);
		expect(result.tasks.filter((task) => !task.closed)).toHaveLength(23);
		expect(result.skipped).toEqual([]);
	});

	it('reads the tag descriptions when the file is listed', async () => {
		const result = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store
		});
		expect(result.tags.descriptions.get('release')).toBe('planned for the next release');
	});

	it('reports progress as files arrive', async () => {
		const onProgress = vi.fn();
		await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store,
			onProgress
		});
		expect(onProgress).toHaveBeenCalledTimes(64);
		expect(onProgress).toHaveBeenLastCalledWith(64, 64);
	});

	it('honours the concurrency limit', async () => {
		let inFlight = 0;
		let peak = 0;
		const counting = (async (input: RequestInfo | URL) => {
			peak = Math.max(peak, ++inFlight);
			await new Promise((resolve) => setTimeout(resolve, 1));
			inFlight -= 1;
			return fetchFixture(input);
		}) as unknown as typeof fetch;

		await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: counting,
			store,
			concurrency: 4
		});
		expect(peak).toBeLessThanOrEqual(4);
	});

	it('refuses a repository with no tasks folder', async () => {
		const bare: Provider = {
			name: 'github',
			list: async () => ({ entries: [{ path: 'README.md' }], source: 'github', mayBeStale: false, branch: 'HEAD' })
		};
		await expect(
			loadRepository(ref, { providers: [bare], fetchImpl: fetchFixture, store })
		).rejects.toThrow(NoTasksFolderError);
	});

	it('lists unreadable tasks instead of dropping them', async () => {
		const flaky = (async (input: RequestInfo | URL) => {
			if (String(input).includes('20260826-200847')) return new Response('', { status: 500 });
			return fetchFixture(input);
		}) as unknown as typeof fetch;

		const result = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: flaky,
			store
		});
		expect(result.tasks).toHaveLength(63);
		expect(result.skipped).toEqual([{ id: '20260826-200847', reason: 'Could not be read' }]);
	});

	it('skips folders whose name is not a task id', async () => {
		const withJunk = fakeProvider('github');
		const original = withJunk.list;
		withJunk.list = async (r, s) => {
			const listing = await original(r, s);
			return { ...listing, entries: [...listing.entries, { path: 'tasks/notes/TASK.md' }] };
		};
		const result = await loadRepository(ref, {
			providers: [withJunk],
			fetchImpl: fetchFixture,
			store
		});
		expect(result.skipped).toEqual([{ id: 'notes', reason: 'Folder name is not a task id' }]);
	});

	it('works when the repository has no tags file', async () => {
		const noTags = fakeProvider('github');
		const original = noTags.list;
		noTags.list = async (r, s) => {
			const listing = await original(r, s);
			return { ...listing, entries: listing.entries.filter((e) => e.path !== 'tasks/tags') };
		};
		const result = await loadRepository(ref, {
			providers: [noTags],
			fetchImpl: fetchFixture,
			store
		});
		expect(result.tags.descriptions.size).toBe(0);
	});
});

describe('caching', () => {
	it('serves a revisit from store, spending no quota at all', async () => {
		const provider = fakeProvider('github');
		const spy = vi.spyOn(provider, 'list');

		const first = await loadRepository(ref, { providers: [provider], fetchImpl: fetchFixture, store });
		expect(first.fromCache).toBe(false);

		const second = await loadRepository(ref, { providers: [provider], fetchImpl: fetchFixture, store });
		expect(second.fromCache).toBe(true);
		expect(second.tasks).toHaveLength(64);
		// The listing is the only rate-limited call; it must not happen twice.
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it('refetches when the reader asks for a refresh', async () => {
		const provider = fakeProvider('github');
		const spy = vi.spyOn(provider, 'list');

		await loadRepository(ref, { providers: [provider], fetchImpl: fetchFixture, store });
		const refreshed = await loadRepository(ref, {
			providers: [provider],
			fetchImpl: fetchFixture,
			store,
			refresh: true
		});
		expect(refreshed.fromCache).toBe(false);
		expect(spy).toHaveBeenCalledTimes(2);
	});

	it('reports when the cached view was fetched, so the UI can show its age', async () => {
		await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store,
			now: () => 1_000
		});
		const cached = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store
		});
		expect(cached.storedAt).toBe(1_000);
	});

	it('restores dates across the cache, which JSON cannot carry', async () => {
		await loadRepository(ref, { providers: [fakeProvider('github')], fetchImpl: fetchFixture, store });
		const cached = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store
		});
		const earliest = cached.tasks.reduce((a, b) => (a.created < b.created ? a : b));
		expect(earliest.created).toBeInstanceOf(Date);
		expect(earliest.id).toBe('20251205-071347');
	});

	it('restores the tag descriptions, which are a Map', async () => {
		await loadRepository(ref, { providers: [fakeProvider('github')], fetchImpl: fetchFixture, store });
		const cached = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store
		});
		expect(cached.tags.descriptions.get('release')).toBe('planned for the next release');
	});

	it('works with no storage at all, as in a private window', async () => {
		const result = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store: memoryStore()
		});
		expect(result.tasks).toHaveLength(64);
		expect(result.fromCache).toBe(false);
	});
});

describe('what the cache keeps', () => {
	it('returns the bodies the caller just paid for', async () => {
		const result = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store
		});
		expect(result.tasks.every((task) => typeof task.description === 'string')).toBe(true);
	});

	it('stores metadata only, dropping the descriptions', async () => {
		await loadRepository(ref, { providers: [fakeProvider('github')], fetchImpl: fetchFixture, store });
		const cached = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store
		});
		expect(cached.fromCache).toBe(true);
		expect(cached.tasks.every((task) => task.description === undefined)).toBe(true);
	});

	it('keeps the references, so the graph survives without the prose', async () => {
		await loadRepository(ref, { providers: [fakeProvider('github')], fetchImpl: fetchFixture, store });
		const cached = await loadRepository(ref, {
			providers: [fakeProvider('github')],
			fetchImpl: fetchFixture,
			store
		});
		const hub = cached.tasks.find((task) => task.id === '20260826-200847');
		expect(hub?.references).toContain('20260826-152351');
		expect(cached.tasks.filter((task) => task.references.length > 0).length).toBeGreaterThan(10);
	});

	it('re-reads one body on demand for the detail view', async () => {
		const { loadTaskDescription } = await import('./load.ts');
		const body = await loadTaskDescription(ref, 'HEAD', '20260826-200847', {
			fetchImpl: fetchFixture
		});
		expect(body).toContain('Cephon wanted to kanban');
	});

	it('returns null when a body cannot be read', async () => {
		const { loadTaskDescription } = await import('./load.ts');
		expect(await loadTaskDescription(ref, 'HEAD', 'nope', { fetchImpl: fetchFixture })).toBeNull();
	});
});

/**
 * A repository of a few task files that can be rewritten between readings —
 * which the 64-task fixture cannot be, being a fixture.
 */
function mutable(files: Record<string, string>) {
	const provider: Provider = {
		name: 'github',
		list: async () => ({
			entries: Object.keys(files).map((id) => ({ path: `tasks/${id}/TASK.md`, size: 1 })),
			source: 'github',
			mayBeStale: false,
			branch: 'HEAD'
		})
	};
	const fetchImpl = (async (input: RequestInfo | URL) => {
		const match = /tasks\/([^/]+)\/TASK\.md$/.exec(String(input));
		return match && files[match[1]]
			? new Response(files[match[1]], { status: 200 })
			: new Response('not found', { status: 404 });
	}) as unknown as typeof fetch;
	return { provider, fetchImpl };
}

const file = (priority: number, tags: string, status = 'OPEN') =>
	`# a task\n\n- STATUS: ${status}\n- PRIORITY: ${priority}\n- TAGS: ${tags}\n`;

describe('what the reader last saw', () => {
	const a = '20260101-000001';
	const b = '20260202-000002';

	it('has nothing behind a first visit', async () => {
		const { provider, fetchImpl } = mutable({ [a]: file(90, 'ui') });
		const first = await loadRepository(ref, { providers: [provider], fetchImpl, store });
		expect(first.previous).toBeNull();
	});

	it('carries the previous reading through a refresh, with its age', async () => {
		const files = { [a]: file(90, 'ui'), [b]: file(50, '') };
		const { provider, fetchImpl } = mutable(files);
		const options = { providers: [provider], fetchImpl, store };

		await loadRepository(ref, { ...options, now: () => 1_000 });
		files[a] = file(90, 'ui', 'CLOSED');
		const refreshed = await loadRepository(ref, { ...options, refresh: true, now: () => 2_000 });

		expect(refreshed.previous?.at).toBe(1_000);
		expect(refreshed.previous?.tasks).toEqual([
			{ id: a, closed: false, priority: 90, tags: ['ui'] },
			{ id: b, closed: false, priority: 50, tags: [] }
		]);
		expect(refreshed.storedAt).toBe(2_000);
	});

	it('still carries it on the next visit, so the news survives a reload', async () => {
		const files = { [a]: file(90, 'ui') };
		const { provider, fetchImpl } = mutable(files);
		const options = { providers: [provider], fetchImpl, store };

		await loadRepository(ref, { ...options, now: () => 1_000 });
		files[a] = file(110, 'ui');
		await loadRepository(ref, { ...options, refresh: true, now: () => 2_000 });

		const revisited = await loadRepository(ref, options);
		expect(revisited.fromCache).toBe(true);
		expect(revisited.previous?.tasks[0].priority).toBe(90);
	});

	it('replaces it on the next refresh rather than accumulating readings', async () => {
		const files = { [a]: file(90, 'ui') };
		const { provider, fetchImpl } = mutable(files);
		const options = { providers: [provider], fetchImpl, store };

		await loadRepository(ref, { ...options, now: () => 1_000 });
		files[a] = file(100, 'ui');
		await loadRepository(ref, { ...options, refresh: true, now: () => 2_000 });
		files[a] = file(110, 'ui');
		const third = await loadRepository(ref, { ...options, refresh: true, now: () => 3_000 });

		// "Since your last read" is the last one, not the first.
		expect(third.previous?.at).toBe(2_000);
		expect(third.previous?.tasks[0].priority).toBe(100);
	});

	it('says nothing at all when a refresh brought nothing', async () => {
		// The comparison is still taken and stored — it is the reading that moved
		// on — so what a view gets is a snapshot identical to the tasks, which
		// compares to no movement.
		const files = { [a]: file(90, 'ui') };
		const { provider, fetchImpl } = mutable(files);
		const options = { providers: [provider], fetchImpl, store };

		await loadRepository(ref, { ...options, now: () => 1_000 });
		const again = await loadRepository(ref, { ...options, refresh: true, now: () => 2_000 });
		expect(again.previous?.tasks).toEqual([{ id: a, closed: false, priority: 90, tags: ['ui'] }]);
	});
});
