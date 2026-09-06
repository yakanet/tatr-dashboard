import { describe, expect, it } from 'vitest';
import { memoryStore, openStore } from './store.ts';

describe('memoryStore', () => {
	it('round-trips a value with its timestamp', async () => {
		const store = memoryStore();
		await store.write('k', { hello: 'world' }, 1_234);
		const stored = await store.read<{ hello: string }>('k');
		expect(stored?.value).toEqual({ hello: 'world' });
		expect(stored?.storedAt).toBe(1_234);
	});

	it('misses on an unknown key', async () => {
		expect(await memoryStore().read('nope')).toBeNull();
	});

	it('never expires, so quota is only spent on request', async () => {
		const store = memoryStore();
		await store.write('k', 1, 0);
		expect((await store.read<number>('k'))?.value).toBe(1);
	});

	it('keeps Date and Map intact, which JSON would not', async () => {
		const store = memoryStore();
		const value = { when: new Date('2026-08-26T20:08:47Z'), tags: new Map([['bug', 'a bug']]) };
		await store.write('k', value);
		const stored = await store.read<typeof value>('k');
		expect(stored?.value.when).toBeInstanceOf(Date);
		expect(stored?.value.tags.get('bug')).toBe('a bug');
	});

	it('clears one key without touching the others', async () => {
		const store = memoryStore();
		await store.write('a', 1);
		await store.write('b', 2);
		await store.clear('a');
		expect(await store.read('a')).toBeNull();
		expect((await store.read<number>('b'))?.value).toBe(2);
	});

	it('clears everything', async () => {
		const store = memoryStore();
		await store.write('a', 1);
		await store.write('b', 2);
		await store.clear();
		expect(await store.read('a')).toBeNull();
		expect(await store.read('b')).toBeNull();
	});
});

describe('openStore', () => {
	it('degrades to memory where IndexedDB does not exist, rather than throwing', async () => {
		// This suite runs under node, so there is no IndexedDB here — which is the
		// same situation as a private window or the prerender pass.
		expect(typeof indexedDB).toBe('undefined');
		const store = openStore();
		await store.write('k', { ok: true });
		expect((await store.read<{ ok: boolean }>('k'))?.value).toEqual({ ok: true });
		await store.clear();
		expect(await store.read('k')).toBeNull();
	});
});
