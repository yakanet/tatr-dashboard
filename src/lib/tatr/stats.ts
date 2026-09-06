/**
 * Summaries of a set of tasks, for the dashboard.
 *
 * Everything here is derived from the four dimensions the format actually
 * carries: binary status, numeric priority, tags, and the creation date encoded
 * in the HUID. There are no closure dates in a task file, so there can be no
 * burndown, no cycle time and no "closed this month" — the activity series
 * counts *creations*, split by present status. Anything else would be invented.
 */
import type { Task } from './task.ts';

export interface Counts {
	total: number;
	open: number;
	closed: number;
	untagged: number;
}

export function counts(tasks: Task[]): Counts {
	return {
		total: tasks.length,
		open: tasks.filter((task) => !task.closed).length,
		closed: tasks.filter((task) => task.closed).length,
		untagged: tasks.filter((task) => task.tags.length === 0).length
	};
}

export interface PriorityBucket {
	priority: number;
	count: number;
}

/**
 * One row per distinct priority, highest first — not fixed ranges, because a
 * repository's priorities are whatever its author chose.
 */
export function byPriority(tasks: Task[]): PriorityBucket[] {
	const seen = new Map<number, number>();
	for (const task of tasks) seen.set(task.priority, (seen.get(task.priority) ?? 0) + 1);
	return [...seen]
		.map(([priority, count]) => ({ priority, count }))
		.sort((a, b) => b.priority - a.priority);
}

export interface TagCount {
	tag: string;
	count: number;
}

/** Tags by frequency, most used first, ties broken alphabetically. */
export function byTag(tasks: Task[]): TagCount[] {
	const seen = new Map<string, number>();
	for (const task of tasks) {
		for (const tag of task.tags) seen.set(tag, (seen.get(tag) ?? 0) + 1);
	}
	return [...seen]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface MonthBucket {
	/** `YYYY-MM`, in UTC, since HUIDs are UTC. */
	month: string;
	open: number;
	closed: number;
}

/**
 * Creations per month, from the first month that has any through the last —
 * empty months included, because their emptiness is the point. Repositories
 * like this one are written in bursts, and a series that silently skips the
 * quiet months would hide that.
 */
export function byMonth(tasks: Task[]): MonthBucket[] {
	if (tasks.length === 0) return [];

	const key = (date: Date) =>
		`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

	const seen = new Map<string, MonthBucket>();
	for (const task of tasks) {
		const month = key(task.created);
		const bucket = seen.get(month) ?? { month, open: 0, closed: 0 };
		if (task.closed) bucket.closed += 1;
		else bucket.open += 1;
		seen.set(month, bucket);
	}

	const times = tasks.map((task) => task.created.getTime());
	const first = new Date(Math.min(...times));
	const last = new Date(Math.max(...times));

	const out: MonthBucket[] = [];
	const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
	const end = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1);

	while (cursor.getTime() <= end) {
		const month = key(cursor);
		out.push(seen.get(month) ?? { month, open: 0, closed: 0 });
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
	}
	return out;
}

/** Tasks a query selected, highest priority first, as `tatr ls` orders them. */
export function topByPriority(tasks: Task[], limit: number): Task[] {
	return tasks
		.toSorted((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
		.slice(0, limit);
}

const MONTH_NAMES = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

/** `2026-03` as `March 2026`. */
export function monthName(month: string): string {
	const [year, index] = month.split('-').map(Number);
	return `${MONTH_NAMES[index - 1]} ${year}`;
}

const WORDS = [
	'no',
	'one',
	'two',
	'three',
	'four',
	'five',
	'six',
	'seven',
	'eight',
	'nine',
	'ten',
	'eleven',
	'twelve'
];

/** Small numbers read better as words in a sentence. */
function inWords(n: number): string {
	return WORDS[n] ?? String(n);
}

export interface Summary {
	/** The clause that leads, e.g. "23 tasks still open". */
	lead: string;
	/** The number in the lead, so it can be emphasised on its own. */
	leadCount: number;
	/** The observation that follows, or `null` when nothing stands out. */
	detail: string | null;
}

/**
 * States a repository's condition in a sentence.
 *
 * The dashboard opens by saying something rather than by presenting a row of
 * counters, so this picks the one fact worth leading with. Every candidate is
 * checked against the data — nothing here is a template with a number dropped
 * into it, and when nothing stands out the sentence simply stops.
 *
 * Each clause names what it counts. "Four of the last seven months" would be
 * ambiguous twice over: the window is the span the tasks cover, not the seven
 * months before today, and a bare "them" would seem to refer to the open tasks
 * in the lead when the figure is over all of them.
 *
 * This describes a whole repository. Do not call it on a filtered subset: "no
 * task was created in four of those months" is false about one, since tasks
 * were created then, just not matching ones.
 */
export function summarise(tasks: Task[], now = new Date()): Summary {
	const { open, total, untagged } = counts(tasks);

	const lead =
		total === 0
			? 'No tasks here yet'
			: open === 0
				? `Nothing left open, out of ${total}`
				: `${open} task${open === 1 ? '' : 's'} still open`;

	if (total === 0) return { lead, leadCount: 0, detail: null };

	const months = byMonth(tasks);
	const empty = months.filter((month) => month.open + month.closed === 0).length;

	// A repository that has gone quiet is the most useful thing to lead with,
	// and it is checked first because the other clauses would bury it.
	const last = months.at(-1);
	if (last) {
		const [year, month] = last.month.split('-').map(Number);
		const monthsSince = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month);
		if (monthsSince >= 3) {
			return { lead, leadCount: open, detail: `nothing new since ${monthName(last.month)}` };
		}
	}

	// Quiet stretches say more about a repository than any average. "Those N
	// months" is the span the tasks cover, which the masthead states above it.
	if (empty >= 2 && months.length >= 3) {
		return {
			lead,
			leadCount: open,
			detail: `no task was created in ${inWords(empty)} of those ${inWords(months.length)} months`
		};
	}

	// A repository whose tags are mostly absent cannot be filtered by them.
	if (untagged * 2 > total) {
		return { lead, leadCount: open, detail: `${untagged} of the ${total} carry no tag at all` };
	}

	const closed = total - open;
	if (closed * 10 >= total * 6) {
		return { lead, leadCount: open, detail: `${closed} of the ${total} are already closed` };
	}

	return { lead, leadCount: open, detail: null };
}
