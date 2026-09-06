import { describe, expect, it } from 'vitest';
import rawTasks from '../../../tests/fixtures/tsoding-tatr-raw.json' with { type: 'json' };
import { byMonth, byPriority, byTag, counts, summarise, topByPriority } from './stats.ts';
import { readTask, type Task } from './task.ts';

const sources = rawTasks as Record<string, string>;
const all = Object.entries(sources).map(([id, source]) => readTask(id, source)!);
const open = all.filter((task) => !task.closed);

const make = (id: string, priority: number, tags: string[], closed = false): Task =>
	readTask(id, `# t\n\n- STATUS: ${closed ? 'CLOSED' : 'OPEN'}\n- PRIORITY: ${priority}\n- TAGS: ${tags.join(',')}\n`)!;

describe('counts', () => {
	it('matches the real repository', () => {
		expect(counts(all)).toEqual({ total: 64, open: 23, closed: 41, untagged: 30 });
	});

	it('is all zeroes for nothing', () => {
		expect(counts([])).toEqual({ total: 0, open: 0, closed: 0, untagged: 0 });
	});
});

describe('byPriority', () => {
	it('matches the real open tasks, highest first', () => {
		expect(byPriority(open)).toEqual([
			{ priority: 110, count: 2 },
			{ priority: 100, count: 13 },
			{ priority: 90, count: 2 },
			{ priority: 50, count: 2 },
			{ priority: 30, count: 2 },
			{ priority: 10, count: 2 }
		]);
	});

	it('sums to the number of tasks', () => {
		expect(byPriority(all).reduce((n, b) => n + b.count, 0)).toBe(64);
	});

	it('shows whatever priorities a repository actually uses', () => {
		expect(byPriority([make('20260101-000001', 7, []), make('20260101-000002', 3, [])])).toEqual([
			{ priority: 7, count: 1 },
			{ priority: 3, count: 1 }
		]);
	});
});

describe('byTag', () => {
	it('matches the real repository, most used first', () => {
		expect(byTag(all)).toEqual([
			{ tag: 'release', count: 21 },
			{ tag: 'bug', count: 9 },
			{ tag: 'tql', count: 8 },
			{ tag: 'wontfix', count: 3 },
			{ tag: 'scope', count: 2 },
			{ tag: 'stream', count: 2 },
			{ tag: 'emacs', count: 1 }
		]);
	});

	it('breaks ties alphabetically, so the order is stable', () => {
		const tasks = [make('20260101-000001', 100, ['b']), make('20260101-000002', 100, ['a'])];
		expect(byTag(tasks).map((t) => t.tag)).toEqual(['a', 'b']);
	});

	it('is empty when nothing is tagged', () => {
		expect(byTag([make('20260101-000001', 100, [])])).toEqual([]);
	});
});

describe('byMonth', () => {
	it('matches the real repository, including its bursts', () => {
		// Only five months have anything; the quiet ones are the point.
		expect(byMonth(all)).toEqual([
			{ month: '2025-12', open: 0, closed: 2 },
			{ month: '2026-01', open: 0, closed: 0 },
			{ month: '2026-02', open: 0, closed: 0 },
			{ month: '2026-03', open: 7, closed: 17 },
			{ month: '2026-04', open: 0, closed: 2 },
			{ month: '2026-05', open: 0, closed: 0 },
			{ month: '2026-06', open: 0, closed: 0 },
			{ month: '2026-07', open: 0, closed: 0 },
			{ month: '2026-08', open: 10, closed: 19 },
			{ month: '2026-09', open: 6, closed: 1 }
		]);
	});

	it('keeps empty months rather than skipping them', () => {
		const months = byMonth([make('20260101-000001', 100, []), make('20260401-000001', 100, [])]);
		expect(months.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
	});

	it('spans a year boundary', () => {
		const months = byMonth([make('20251201-000001', 100, []), make('20260201-000001', 100, [])]);
		expect(months.map((m) => m.month)).toEqual(['2025-12', '2026-01', '2026-02']);
	});

	it('is empty for nothing', () => {
		expect(byMonth([])).toEqual([]);
	});

	it('sums to the number of tasks', () => {
		const months = byMonth(all);
		expect(months.reduce((n, m) => n + m.open + m.closed, 0)).toBe(64);
	});
});

describe('topByPriority', () => {
	it('takes the most urgent first', () => {
		expect(topByPriority(open, 2).map((task) => task.priority)).toEqual([110, 110]);
	});

	it('breaks ties by id, so the order is stable', () => {
		expect(topByPriority(open, 2).map((task) => task.id)).toEqual([
			'20260828-211200',
			'20260830-041724'
		]);
	});

	it('returns everything when the limit exceeds the set', () => {
		expect(topByPriority(open, 500)).toHaveLength(23);
	});
});

describe('summarise', () => {
	it('states the real repository in a sentence', () => {
		const summary = summarise(all, new Date('2026-09-07T00:00:00Z'));
		expect(summary.lead).toBe('23 tasks still open');
		// December 2025 through September 2026 is ten months; five have nothing.
		expect(summary.detail).toBe('nothing was written in five of the last ten months');
	});

	it('counts the quiet months correctly', () => {
		const months = byMonth(all);
		const empty = months.filter((m) => m.open + m.closed === 0).length;
		expect(months).toHaveLength(10);
		expect(empty).toBe(5);
	});

	it('leads with the untagged share when the calendar is unremarkable', () => {
		// Two consecutive months, so no quiet stretch, but nothing is tagged.
		const tasks = [
			make('20260801-000001', 100, []),
			make('20260901-000001', 100, []),
			make('20260901-000002', 100, ['bug'])
		];
		expect(summarise(tasks, new Date('2026-09-07T00:00:00Z')).detail).toBe(
			'67% of them carry no tag at all'
		);
	});

	it('says when a repository has gone quiet', () => {
		const tasks = [make('20260101-000001', 100, ['bug']), make('20260201-000001', 100, ['bug'])];
		expect(summarise(tasks, new Date('2026-09-07T00:00:00Z')).detail).toBe(
			'nothing new in seven months'
		);
	});

	it('mentions how much is done when nothing else stands out', () => {
		const tasks = [
			make('20260801-000001', 100, ['bug'], true),
			make('20260801-000002', 100, ['bug'], true),
			make('20260901-000001', 100, ['bug'])
		];
		expect(summarise(tasks, new Date('2026-09-07T00:00:00Z')).detail).toBe(
			'67% of the work is already done'
		);
	});

	it('says nothing rather than inventing an observation', () => {
		const tasks = [make('20260801-000001', 100, ['bug']), make('20260901-000001', 100, ['bug'])];
		expect(summarise(tasks, new Date('2026-09-07T00:00:00Z')).detail).toBeNull();
	});

	it('handles an empty repository and one with nothing open', () => {
		expect(summarise([]).lead).toBe('No tasks here yet');
		expect(summarise([make('20260901-000001', 100, ['bug'], true)]).lead).toBe(
			'Nothing left open, out of 1'
		);
	});

	it('says "1 task", not "1 tasks"', () => {
		expect(summarise([make('20260901-000001', 100, ['bug'])]).lead).toBe('1 task still open');
	});
});
