/**
 * Assembles a task from its folder name and its `TASK.md`, and orders tasks the
 * way the CLI does.
 */
import { parseHuid } from './huid.ts';
import { isClosed, parseTaskMd, readPriority, readTags } from './task-md.ts';

export interface Task {
	/** Folder name, which is also the creation timestamp. */
	id: string;
	created: Date;
	/** Team suffix, when the id carries one. */
	suffix?: string;
	title: string;
	/** The raw STATUS value, which may be anything the author wrote. */
	status: string;
	/** True only when the status is exactly `CLOSED`. */
	closed: boolean;
	priority: number;
	tags: string[];
	/** Every property, including keys outside the documented three. */
	properties: Map<string, string>;
	description: string;
	/** True when the title line was missing its `#`, which voids the properties. */
	malformed: boolean;
}

/**
 * Builds a task. Returns `null` when the folder name is not a HUID — the CLI
 * skips those entries rather than failing.
 */
export function readTask(id: string, taskMd: string): Task | null {
	const huid = parseHuid(id);
	if (!huid) return null;

	const parsed = parseTaskMd(taskMd);
	const task: Task = {
		id: huid.id,
		created: huid.created,
		title: parsed.title,
		status: parsed.properties.get('STATUS') ?? 'OPEN',
		closed: isClosed(parsed.properties),
		priority: readPriority(parsed.properties),
		tags: readTags(parsed.properties),
		properties: parsed.properties,
		description: parsed.description,
		malformed: parsed.malformed
	};
	return huid.suffix ? { ...task, suffix: huid.suffix } : task;
}

/** Default CLI order: priority descending, so the most urgent comes first. */
export function compareByPriority(a: Task, b: Task): number {
	return b.priority - a.priority;
}

/** `tatr ls -id`: lexicographic by id, which is chronological. */
export function compareById(a: Task, b: Task): number {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
