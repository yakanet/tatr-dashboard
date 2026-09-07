import { describe, expect, it } from 'vitest';
import { KINDS, openSource } from './open.ts';
import { localRef, parseRepoPath, type RepoRef } from '../repo/ref.ts';

const refs: RepoRef[] = [
	parseRepoPath('tsoding/tatr')!,
	parseRepoPath('yakanet/tatr-dashboard@main')!,
	parseRepoPath('gitlab.com/group/project')!,
	localRef('tatr-site')
];

describe('the registry', () => {
	it('keys every kind by its own id', () => {
		// Computed keys, so a key cannot drift from the id it stands for.
		for (const [key, kind] of Object.entries(KINDS)) expect(key).toBe(kind.id);
	});

	it('claims nothing twice', () => {
		// The property a record depends on: with disjoint claims there is no
		// precedence to encode, so nothing rests on the order of the keys.
		for (const ref of refs) {
			const claimants = Object.values(KINDS).filter((kind) => kind.claims(ref));
			expect(claimants.map((kind) => kind.id)).toHaveLength(1);
		}
	});
});

describe('openSource', () => {
	it('opens a repository on a forge', () => {
		const source = openSource(parseRepoPath('tsoding/tatr')!);
		expect(source?.id).toBe('github');
		expect(source?.label).toBe('tsoding/tatr');
		expect(source?.cacheKey).toBe('github.com/tsoding/tatr@');
		expect(source?.fileUrl?.('tasks/a/TASK.md')).toContain('/blob/HEAD/tasks/a/TASK.md');
	});

	it('reads a forge at the branch it was asked for', () => {
		const source = openSource(parseRepoPath('tsoding/tatr')!, { branch: 'dev' });
		expect(source?.assetUrl('tasks/a/shot.png')).toContain('/tatr/dev/tasks/a/shot.png');
	});

	it('opens the folder on this machine', () => {
		const source = openSource(localRef());
		expect(source?.id).toBe('local');
		// The two members that say what a folder is: nowhere to cache it, and no
		// page anywhere to link one of its files to.
		expect(source?.cacheKey).toBeNull();
		expect(source?.fileUrl).toBeUndefined();
	});
});
