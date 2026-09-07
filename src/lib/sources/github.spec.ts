import { describe, expect, it } from 'vitest';
import { blobUrl, rawUrl } from './github.ts';
import { parseRepoInput } from '../repo/ref.ts';

const ref = parseRepoInput('tsoding/tatr')!;
const path = 'tasks/20260304-115038/TASK.md';

describe('rawUrl', () => {
	it('reads a file from the CDN that costs no budget', () => {
		expect(rawUrl(ref, 'HEAD', path)).toBe(
			'https://raw.githubusercontent.com/tsoding/tatr/HEAD/tasks/20260304-115038/TASK.md'
		);
	});

	it('keeps the slashes of a branch that has them', () => {
		// `feature%2Fweb-ui` is a branch of that literal name, which nobody has, so
		// encoding the whole thing at once made every read of such a repository
		// fail.
		expect(rawUrl(ref, 'feature/web-ui', path)).toContain('/tatr/feature/web-ui/tasks/');
	});

	it('encodes what a segment cannot carry', () => {
		expect(rawUrl(ref, 'HEAD', 'tasks/a b/TASK.md')).toContain('/tasks/a%20b/TASK.md');
	});
});

describe('blobUrl', () => {
	it('points at the file on the forge, where its history is', () => {
		expect(blobUrl(ref, 'HEAD', path)).toBe(
			'https://github.com/tsoding/tatr/blob/HEAD/tasks/20260304-115038/TASK.md'
		);
	});

	it('uses the host the repository was named with', () => {
		// The one URL that lives on the forge's own domain rather than on a CDN.
		const elsewhere = parseRepoInput('example.com/owner/name')!;
		expect(blobUrl(elsewhere, 'HEAD', path)).toBe(
			`https://example.com/owner/name/blob/HEAD/${path}`
		);
	});

	it('keeps a branch with slashes, as the raw URL does', () => {
		expect(blobUrl(ref, 'feature/web-ui', path)).toContain('/blob/feature/web-ui/tasks/');
	});
});
