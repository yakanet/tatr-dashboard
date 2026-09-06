import { beforeEach, describe, expect, it } from 'vitest';
import { clearCache, memoryStorage, readCache, writeCache, type CacheStorage } from './cache.ts';

let store: CacheStorage;

beforeEach(() => {
	store = memoryStorage();
});

describe('cache', () => {
	it('round-trips a value', () => {
		writeCache('k', { hello: 'world' }, 1_000, store);
		expect(readCache<{ hello: string }>('k', store)?.value).toEqual({ hello: 'world' });
	});

	it('misses on an unknown key', () => {
		expect(readCache('nope', store)).toBeNull();
	});

	it('never expires on its own, so quota is only spent on request', () => {
		writeCache('k', 1, 0, store);
		// A year later, still served: refreshing is the reader's decision.
		expect(readCache<number>('k', store)?.value).toBe(1);
	});

	it('records when the entry was written', () => {
		writeCache('k', 1, 1_234, store);
		expect(readCache('k', store)?.storedAt).toBe(1_234);
	});

	it('treats corrupt entries as a miss', () => {
		store.setItem('tatr:repo:broken', '{not json');
		expect(readCache('broken', store)).toBeNull();
	});

	it('treats an entry without a timestamp as a miss', () => {
		store.setItem('tatr:repo:odd', '{"value":1}');
		expect(readCache('odd', store)).toBeNull();
	});

	it('clears one key without touching the others', () => {
		writeCache('a', 1, 0, store);
		writeCache('b', 2, 0, store);
		clearCache('a', store);
		expect(readCache('a', store)).toBeNull();
		expect(readCache<number>('b', store)?.value).toBe(2);
	});

	it('clears everything it owns', () => {
		writeCache('a', 1, 0, store);
		writeCache('b', 2, 0, store);
		store.setItem('unrelated', 'keep me');
		clearCache(undefined, store);
		expect(readCache('a', store)).toBeNull();
		expect(store.getItem('unrelated')).toBe('keep me');
	});

	it('survives storage that throws, as in a private window', () => {
		const throwing: CacheStorage = {
			getItem: () => {
				throw new Error('denied');
			},
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
			removeItem: () => {
				throw new Error('denied');
			},
			length: 0,
			key: () => null
		};
		expect(() => writeCache('k', 1, 0, throwing)).not.toThrow();
		expect(readCache('k', throwing)).toBeNull();
		expect(() => clearCache('k', throwing)).not.toThrow();
	});

	it('does nothing when there is no storage', () => {
		expect(readCache('k', null)).toBeNull();
		expect(() => writeCache('k', 1, 0, null)).not.toThrow();
	});
});
