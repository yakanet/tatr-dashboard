/**
 * Assembles a task from its folder name and its `TASK.md`, and orders tasks the
 * way the CLI does.
 */
import { parseHuid } from './huid.ts';
import { isClosed, parseTaskMd, readPriority, readTags } from './task-md.ts';

/** HUIDs as they appear inside prose: bare, or wrapped as `TASK(...)`. */
const REFERENCE = /\b(\d{8}-\d{6}(?:-[A-Za-z0-9-]+)?)\b/g;

/** Task ids mentioned in a body, minus the task's own. */
export function extractReferences(body: string, selfId?: string): string[] {
	const found = new Set<string>();
	for (const match of body.matchAll(REFERENCE)) {
		if (match[1] !== selfId) found.add(match[1]);
	}
	return [...found].sort();
}

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
	/**
	 * Task ids this task mentions in its body, deduplicated and self-references
	 * removed. Extracted at parse time so the cross-reference graph survives
	 * without keeping every description around: the ids cost about 2 kB for a
	 * 64-task repository, the descriptions cost 24 kB.
	 */
	references: string[];
	/**
	 * The body. Present when the task was just read, absent when it came from the
	 * cache, which stores metadata only — fetch it with `loadTaskDescription`.
	 */
	description?: string;
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
		references: extractReferences(parsed.description, huid.id),
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
