import { describe, expect, it } from 'vitest';
import { formatRepoPath, parseRepoInput, parseRepoPath, repoKey } from './ref.ts';

describe('parseRepoPath', () => {
	it('defaults the host to github.com', () => {
		expect(parseRepoPath('tsoding/tatr')).toEqual({
			host: 'github.com',
			owner: 'tsoding',
			name: 'tatr'
		});
	});

	it('accepts an explicit forge host', () => {
		expect(parseRepoPath('gitlab.com/tsoding/tatr')).toEqual({
			host: 'gitlab.com',
			owner: 'tsoding',
			name: 'tatr'
		});
	});

	it('reads a branch from the @ suffix', () => {
		expect(parseRepoPath('tsoding/tatr@dev')).toEqual({
			host: 'github.com',
			owner: 'tsoding',
			name: 'tatr',
			branch: 'dev'
		});
	});

	it('keeps slashes inside branch names', () => {
		expect(parseRepoPath('tsoding/tatr@feature/web-ui')?.branch).toBe('feature/web-ui');
	});

	it('tolerates surrounding slashes', () => {
		expect(parseRepoPath('/tsoding/tatr/')?.name).toBe('tatr');
	});

	it('allows dots in repository names, which are not hosts', () => {
		expect(parseRepoPath('sveltejs/svelte.dev')).toEqual({
			host: 'github.com',
			owner: 'sveltejs',
			name: 'svelte.dev'
		});
	});

	it.each(['', '/', 'tsoding', 'a/b/c', 'tsoding/', 'tsoding/ta tr'])(
		'rejects %o',
		(input) => {
			expect(parseRepoPath(input)).toBeNull();
		}
	);
});

describe('parseRepoInput', () => {
	it('accepts a browser URL', () => {
		expect(parseRepoInput('https://github.com/tsoding/tatr')).toEqual({
			host: 'github.com',
			owner: 'tsoding',
			name: 'tatr'
		});
	});

	it('takes the branch from a tree URL', () => {
		expect(parseRepoInput('https://github.com/tsoding/tatr/tree/dev/tasks')).toEqual({
			host: 'github.com',
			owner: 'tsoding',
			name: 'tatr',
			branch: 'dev'
		});
	});

	it('keeps only the first segment after tree, since the path is inseparable', () => {
		expect(parseRepoInput('https://github.com/tsoding/tatr/tree/feature/web-ui')?.branch).toBe(
			'feature'
		);
	});

	it('accepts an SSH remote and strips the .git suffix', () => {
		expect(parseRepoInput('git@github.com:tsoding/tatr.git')).toEqual({
			host: 'github.com',
			owner: 'tsoding',
			name: 'tatr'
		});
	});

	it('accepts the bare shorthand', () => {
		expect(parseRepoInput('  tsoding/tatr  ')?.owner).toBe('tsoding');
	});

	it('does not mistake a URL scheme for an SSH host', () => {
		expect(parseRepoInput('https://example.com')).toBeNull();
	});
});

describe('formatRepoPath', () => {
	it.each([
		['tsoding/tatr'],
		['tsoding/tatr@dev'],
		['gitlab.com/tsoding/tatr'],
		['gitlab.com/tsoding/tatr@feature/web-ui']
	])('round-trips %o', (path) => {
		const ref = parseRepoPath(path);
		expect(ref).not.toBeNull();
		expect(formatRepoPath(ref!)).toBe(path);
	});

	it('omits the default host', () => {
		expect(formatRepoPath({ host: 'github.com', owner: 'a', name: 'b' })).toBe('a/b');
	});
});

describe('repoKey', () => {
	it('separates the default branch from a named one', () => {
		const implicit = repoKey(parseRepoPath('tsoding/tatr')!);
		const explicit = repoKey(parseRepoPath('tsoding/tatr@main')!);
		expect(implicit).not.toBe(explicit);
	});
});
