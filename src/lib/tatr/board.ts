/**
 * The board: three columns, from the one tag that means a stage.
 *
 * A column per tag is the obvious reading of "columns from tags" and it does not
 * work — 10 of the 64 tasks in tsoding/tatr carry more than one, so the same
 * card would appear in several columns at once. Tags there are categories
 * (`bug`, `ui`, `tql`), not steps.
 *
 * `scope` is the exception, and the reason a board is possible at all: upstream
 * it means "currently working on", which is exactly a stage. So the columns are
 * closed, `scope`, and everything else — the shape upstream arrived at in its
 * own task 20260826-200847, "Maybe if the people want to kanban this entire
 * thing they should just use tags for that?".
 *
 * Read-only. A card cannot be dragged because there is nothing to drag it into:
 * moving one would mean writing to the repository, and this viewer never writes.
 */
import { compareById, compareByPriority, type Task } from './task.ts';

/** The tag upstream uses for "currently working on". */
export const IN_PROGRESS = 'scope';

export type ColumnKey = 'backlog' | 'progress' | 'done';

export interface Column {
	key: ColumnKey;
	name: string;
	/** What lands here, said plainly enough that nobody has to guess. */
	hint: string;
	tasks: Task[];
}

/**
 * Sorts the three columns.
 *
 * Open tasks go by priority, as `tatr ls` does. Closed ones go newest first
 * instead, because priority stops meaning anything once a task is done — which
 * is the whole of upstream task 20260304-115038, "Priority becomes irrelevant
 * when the task is closed (modification date is more important)". The id is the
 * closest thing to a date we hold, the modification time not being in the
 * format.
 */
export function toColumns(tasks: readonly Task[]): Column[] {
	const backlog: Task[] = [];
	const progress: Task[] = [];
	const done: Task[] = [];

	for (const task of tasks) {
		// Closed wins over `scope`: a task left tagged after being finished is
		// finished, and a card belongs to exactly one column.
		if (task.closed) done.push(task);
		else if (task.tags.includes(IN_PROGRESS)) progress.push(task);
		else backlog.push(task);
	}

	const byPriority = (list: Task[]) =>
		list.toSorted((a, b) => compareByPriority(a, b) || compareById(a, b));

	return [
		{
			key: 'backlog',
			name: 'Backlog',
			hint: 'open, nobody on it',
			tasks: byPriority(backlog)
		},
		{
			key: 'progress',
			name: 'In progress',
			hint: `tagged :${IN_PROGRESS}`,
			tasks: byPriority(progress)
		},
		{
			key: 'done',
			name: 'Done',
			hint: 'closed, newest first',
			tasks: done.toSorted((a, b) => compareById(b, a))
		}
	];
}
