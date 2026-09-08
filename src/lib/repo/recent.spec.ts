import { describe, expect, it } from 'vitest';
import { formatRepoPath } from './ref.ts';
import { parseKey, REFERENCE, toSuggestions, type CachedShape } from './recent.ts';

const row = (key: string, closed: number, open: number, storedAt = 1) => ({
	key,
	storedAt,
	value: {
		tasks: [
			...Array.from({ length: closed }, () => ({ closed: true })),
			...Array.from({ length: open }, () => ({ closed: false }))
		]
	} satisfies CachedShape
});

const suggest = (rows: ReturnType<typeof row>[]) => toSuggestions(rows, formatRepoPath);

describe('parseKey', () => {
	it('reads back what repoKey writes', () => {
		expect(parseKey('github.com/tsoding/tatr@')).toEqual({
			host: 'github.com',
			owner: 'tsoding',
			name: 'tatr'
		});
	});

	it('keeps a branch', () => {
		expect(parseKey('github.com/tsoding/tatr@dev')).toEqual({
			host: 'github.com',
			owner: 'tsoding',
			name: 'tatr',
			branch: 'dev'
		});
	});

	it('keeps a branch containing slashes', () => {
		// Splitting on the last segment would have lost half of this.
		expect(parseKey('github.com/tsoding/tatr@feature/web-ui')?.branch).toBe('feature/web-ui');
	});

	it('gives up on a key it cannot read', () => {
		expect(parseKey('nonsense')).toBeNull();
		expect(parseKey('')).toBeNull();
	});
});

describe('toSuggestions', () => {
	it('counts what each cached repository holds', () => {
		expect(suggest([row('github.com/tsoding/tatr@', 41, 23)])).toEqual([
			{
				ref: { host: 'github.com', owner: 'tsoding', name: 'tatr' },
				path: 'tsoding/tatr',
				total: 64,
				open: 23,
				storedAt: 1
			}
		]);
	});

	it('keeps the order it was given, the store having sorted it', () => {
		const found = suggest([row('github.com/a/one@', 0, 1, 30), row('github.com/b/two@', 0, 1, 20)]);
		expect(found.map((one) => one.path)).toEqual(['a/one', 'b/two']);
	});

	it('shows a branch in the path, so two views of one repository differ', () => {
		const found = suggest([
			row('github.com/tsoding/tatr@', 0, 1),
			row('github.com/tsoding/tatr@dev', 0, 1)
		]);
		expect(found.map((one) => one.path)).toEqual(['tsoding/tatr', 'tsoding/tatr@dev']);
	});

	it('skips a key it cannot read rather than offering a dead card', () => {
		const found = suggest([row('nonsense', 0, 1), row('github.com/a/one@', 0, 1)]);
		expect(found.map((one) => one.path)).toEqual(['a/one']);
	});

	it('falls back to the reference implementation on an empty cache', () => {
		expect(suggest([])).toEqual([
			{ ref: REFERENCE, path: 'tsoding/tatr', total: 0, open: 0, storedAt: null }
		]);
	});

	it('falls back when every key is unreadable, not just when there are none', () => {
		expect(suggest([row('nonsense', 0, 1)])[0].storedAt).toBeNull();
	});

	it('counts a repository with no tasks at all without dividing by anything', () => {
		expect(suggest([row('github.com/a/one@', 0, 0)])[0]).toMatchObject({ total: 0, open: 0 });
	});
});
