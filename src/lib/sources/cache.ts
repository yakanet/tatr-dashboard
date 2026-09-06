/**
 * Persistent cache for a loaded repository.
 *
 * Listing a repository is the only operation that costs quota — 60 requests per
 * hour per IP address, and a conditional request answering 304 still counts when
 * unauthenticated (measured: remaining went 59 → 58 → 57 across three identical
 * `If-None-Match` calls). Expiring the cache on a timer would therefore spend
 * that budget on the visitor's behalf, without them asking.
 *
 * So entries do not expire. A repository is fetched once, served from storage
 * afterwards, and refreshed only when the reader asks for it. The age is exposed
 * so the UI can say how old the view is.
 *
 * Every accessor is defensive: storage throws in private windows and embedded
 * contexts, and a stored value can always be corrupt.
 */

const PREFIX = 'tatr:repo:';

export interface CacheEntry<T> {
	value: T;
	/** When the entry was written, in epoch milliseconds. */
	storedAt: number;
}

/** The subset of the Storage API this module uses, so it can be faked in tests. */
export interface CacheStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
	readonly length: number;
	key(index: number): string | null;
}

function defaultStorage(): CacheStorage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function readCache<T>(key: string, store: CacheStorage | null = defaultStorage()): CacheEntry<T> | null {
	if (!store) return null;

	let raw: string | null;
	try {
		raw = store.getItem(PREFIX + key);
	} catch {
		return null;
	}
	if (!raw) return null;

	try {
		const entry = JSON.parse(raw) as CacheEntry<T>;
		return typeof entry?.storedAt === 'number' ? entry : null;
	} catch {
		return null;
	}
}

export function writeCache<T>(
	key: string,
	value: T,
	now = Date.now(),
	store: CacheStorage | null = defaultStorage()
): void {
	if (!store) return;
	try {
		store.setItem(PREFIX + key, JSON.stringify({ value, storedAt: now } satisfies CacheEntry<T>));
	} catch {
		// Quota exceeded, or storage disabled. The cache is an optimisation.
	}
}

export function clearCache(key?: string, store: CacheStorage | null = defaultStorage()): void {
	if (!store) return;
	try {
		if (key !== undefined) {
			store.removeItem(PREFIX + key);
			return;
		}
		const names: string[] = [];
		for (let i = 0; i < store.length; i += 1) {
			const name = store.key(i);
			if (name?.startsWith(PREFIX)) names.push(name);
		}
		for (const name of names) store.removeItem(name);
	} catch {
		// Nothing to do; see above.
	}
}

/** An in-memory {@link CacheStorage}, for tests and for contexts without one. */
export function memoryStorage(): CacheStorage {
	const map = new Map<string, string>();
	return {
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => void map.set(key, value),
		removeItem: (key) => void map.delete(key),
		get length() {
			return map.size;
		},
		key: (index) => [...map.keys()][index] ?? null
	};
}
