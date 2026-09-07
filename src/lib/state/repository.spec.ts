import { describe, expect, it } from 'vitest';
import { describeAge, RepositoryState } from './repository.svelte.ts';
import { snapshot } from '../tatr/changes.ts';
import { readTask, type Task } from '../tatr/task.ts';

/**
 * The wording comes from `Intl`, so what is worth pinning here are the
 * thresholds and the rounding: `Intl` formats a number and a unit, it does not
 * pick them, and "just now" is not a unit it knows.
 */

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

const make = (id: string, priority: number, closed = false): Task =>
	readTask(id, `# t\n\n- STATUS: ${closed ? 'CLOSED' : 'OPEN'}\n- PRIORITY: ${priority}\n`)!;

/** A state holding one reading and, optionally, the one before it. */
const reading = (tasks: Task[], previous: Task[] | null, when = 1_000) => {
	const repo = new RepositoryState();
	repo.tasks = tasks;
	repo.previous = previous && snapshot(previous, when);
	return repo;
};

describe('what moved since the last reading', () => {
	const open = make('20260101-000001', 90);

	it('is null with nothing behind it, as on a first visit', () => {
		expect(reading([open], null).changes).toBeNull();
	});

	it('is null when the repository did not move, rather than an empty result', () => {
		// One thing for a view to test, and no way to announce nothing.
		expect(reading([open], [open]).changes).toBeNull();
	});

	it('reports what moved, against the time it is comparing with', () => {
		const changes = reading([make('20260101-000001', 90, true)], [open], 5_000).changes;
		expect(changes?.total).toBe(1);
		expect(changes?.since).toBe(5_000);
		expect(changes?.moved.get('20260101-000001')).toEqual(['closed']);
	});
});
