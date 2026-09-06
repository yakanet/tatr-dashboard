import { describe, expect, it } from 'vitest';
import { describeAge } from './repository.svelte.ts';

const NOW = 1_000_000_000;
const ago = (ms: number) => describeAge(NOW - ms, NOW);

describe('describeAge', () => {
	it.each([
		[0, 'just now'],
		[30_000, 'just now'],
		[60_000, '1 minute ago'],
		[12 * 60_000, '12 minutes ago'],
		[60 * 60_000, '1 hour ago'],
		[5 * 60 * 60_000, '5 hours ago'],
		[26 * 60 * 60_000, '1 day ago'],
		[3 * 24 * 60 * 60_000, '3 days ago']
	])('renders %i ms as %o', (elapsed, expected) => {
		expect(ago(elapsed)).toBe(expected);
	});

	it('does not go negative when the clock moves backwards', () => {
		expect(describeAge(NOW + 10_000, NOW)).toBe('just now');
	});
});
