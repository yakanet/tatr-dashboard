/**
 * Where a loaded repository is kept between visits.
 *
 * IndexedDB rather than localStorage, for three reasons that showed up in
 * measurement rather than in principle:
 *
 * - **Size.** One 64-task repository serialises to ~45 kB, so localStorage's
 *   ~5 MB would hold about a hundred of them — but a single repository with a
 *   few thousand tasks reaches several megabytes and would fill it alone.
 * - **Blocking.** localStorage is synchronous, so parsing a multi-megabyte
 *   entry stalls the main thread at exactly the moment the page is trying to
 *   render.
 * - **Types.** IndexedDB stores structured clones, so `Date` and `Map` survive
 *   a round trip. Through JSON they do not, and the loader would have to
 *   rebuild them by hand on every read.
 *
 * Storage is unavailable in several ordinary situations — private windows,
 * embedded contexts, the prerender pass, tests — so every path degrades to an
 * in-memory store rather than failing.
 */

const DB_NAME = 'tatr';
const DB_VERSION = 1;
const STORE = 'repositories';

export interface StoredRepo<T> {
	value: T;
	/** When this view was fetched, in epoch milliseconds. */
	storedAt: number;
}

export interface RepoStore {
	read<T>(key: string): Promise<StoredRepo<T> | null>;
	write<T>(key: string, value: T, now?: number): Promise<void>;
	clear(key?: string): Promise<void>;
}

/** A store that lives for the lifetime of the page. Always available. */
export function memoryStore(): RepoStore {
	const map = new Map<string, StoredRepo<unknown>>();
	return {
		async read<T>(key: string) {
			return (map.get(key) as StoredRepo<T> | undefined) ?? null;
		},
		async write<T>(key: string, value: T, now = Date.now()) {
			map.set(key, { value, storedAt: now });
		},
		async clear(key?: string) {
			if (key === undefined) map.clear();
			else map.delete(key);
		}
	};
}

function request<T>(req: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
		// Firefox in private mode resolves neither; do not hang the page on it.
		req.onblocked = () => reject(new Error('IndexedDB blocked'));
	});
}

/**
 * The persistent store, falling back to memory wherever IndexedDB cannot be
 * used. Failures are silent by design: the cache is an optimisation, and a
 * visitor with storage disabled should still see their repository.
 */
export function openStore(): RepoStore {
	const fallback = memoryStore();
	let db: Promise<IDBDatabase> | null = null;

	const database = async (): Promise<IDBDatabase | null> => {
		if (typeof indexedDB === 'undefined') return null;
		db ??= openDatabase();
		try {
			return await db;
		} catch {
			db = null;
			return null;
		}
	};

	const transact = async <T>(
		mode: IDBTransactionMode,
		run: (store: IDBObjectStore) => IDBRequest<T>
	): Promise<T | undefined> => {
		const handle = await database();
		if (!handle) return undefined;
		try {
			return await request(run(handle.transaction(STORE, mode).objectStore(STORE)));
		} catch {
			return undefined;
		}
	};

	return {
		async read<T>(key: string) {
			const handle = await database();
			if (!handle) return fallback.read<T>(key);
			const stored = await transact<StoredRepo<T> | undefined>('readonly', (store) =>
				store.get(key) as IDBRequest<StoredRepo<T> | undefined>
			);
			return stored && typeof stored.storedAt === 'number' ? stored : null;
		},

		async write<T>(key: string, value: T, now = Date.now()) {
			const handle = await database();
			if (!handle) return fallback.write(key, value, now);
			await transact('readwrite', (store) => store.put({ value, storedAt: now }, key));
		},

		async clear(key?: string) {
			const handle = await database();
			if (!handle) return fallback.clear(key);
			await transact('readwrite', (store) => (key === undefined ? store.clear() : store.delete(key)));
		}
	};
}
