import { describe, expect, it } from 'vitest';
import { formatHuid, isValidHuid, parseHuid, scanHuids } from './huid.ts';

describe('parseHuid', () => {
	it('reads the timestamp as UTC', () => {
		const huid = parseHuid('20260826-200847');
		expect(huid?.created.toISOString()).toBe('2026-08-26T20:08:47.000Z');
		expect(huid?.suffix).toBeUndefined();
	});

	it('keeps a team suffix', () => {
		const huid = parseHuid('20260830-000838-rexim');
		expect(huid?.suffix).toBe('rexim');
		expect(huid?.created.toISOString()).toBe('2026-08-30T00:08:38.000Z');
	});

	it('allows dashes and digits inside the suffix', () => {
		expect(parseHuid('20260830-000838-team-01')?.suffix).toBe('team-01');
	});

	it.each([
		'2026083-000838',
		'20260830-00083',
		'20260830',
		'20260830_000838',
		'20260830-000838-bad_suffix',
		'tags',
		''
	])('rejects %o', (id) => {
		expect(parseHuid(id)).toBeNull();
	});

	it('rejects digits that are not a real instant', () => {
		// Date.UTC would roll 31 February over into March.
		expect(parseHuid('20260231-000000')).toBeNull();
		expect(parseHuid('20260830-250000')).toBeNull();
	});

	it('accepts a leap day', () => {
		expect(parseHuid('20240229-120000')?.created.toISOString()).toBe('2024-02-29T12:00:00.000Z');
	});
});

describe('isValidHuid', () => {
	it('accepts both forms', () => {
		expect(isValidHuid('20260906-211152')).toBe(true);
		expect(isValidHuid('20260830-000838-rexim')).toBe(true);
	});

	it('rejects the tags file that sits beside the task folders', () => {
		expect(isValidHuid('tags')).toBe(false);
	});
});

describe('formatHuid', () => {
	it('round-trips', () => {
		const id = '20260906-211152';
		expect(formatHuid(parseHuid(id)!.created)).toBe(id);
	});

	it('pads every component', () => {
		expect(formatHuid(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('20260102-030405');
	});

	it('appends a suffix', () => {
		expect(formatHuid(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)), 'rexim')).toBe(
			'20260102-030405-rexim'
		);
	});
});

describe('scanHuids', () => {
	it('reads ids out of prose, in order and with repeats', () => {
		expect(scanHuids('see 20260101-000001, then 20260101-000002 and 20260101-000001')).toEqual([
			'20260101-000001',
			'20260101-000002',
			'20260101-000001'
		]);
	});

	it('reads the wrappers the format uses', () => {
		expect(scanHuids('TASK(20260101-000001) and ## NOTE(20260101-000002)')).toEqual([
			'20260101-000001',
			'20260101-000002'
		]);
	});

	it('keeps a team suffix', () => {
		expect(scanHuids('20260101-000001-rexim')).toEqual(['20260101-000001-rexim']);
	});

	it('needs no word boundary, as the C scanner has none', () => {
		expect(scanHuids('abc20260101-000001')).toEqual(['20260101-000001']);
	});

	it('finds nothing in a text without ids', () => {
		expect(scanHuids('2026-01-01 is not one, nor is 20260101')).toEqual([]);
	});

	it('resumes just past an id, so two glued ids both count', () => {
		expect(scanHuids('20260101-00000120260101-000002')).toEqual([
			'20260101-000001',
			'20260101-000002'
		]);
	});
});
