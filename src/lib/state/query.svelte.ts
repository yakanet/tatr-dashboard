/**
 * The query, shared by every view of a repository.
 *
 * It is global state on purpose: the dashboard's charts are both a
 * visualisation and a control, so clicking a tag bar has to filter the list,
 * the counts and the other charts at once. Keeping it in the URL means a
 * filtered view is a link someone can send.
 */
import { compile, parseWithWarnings, TqlError, type TqlTask, type TqlWarning } from '../tql.ts';
import type { Task } from '../tatr/task.ts';

export const QUERY = Symbol('query');

/**
 * A stand-in task, used to surface type errors while compiling.
 *
 * The query language is typed, but its checks run during evaluation rather than
 * during parsing: `priority` parses perfectly and yields an integer where a
 * boolean is required, so `compile` accepts it and the error only appears once a
 * real task goes through — in the middle of rendering, where it takes the page
 * down instead of being reported.
 *
 * One witness catches every such error, because `and` and `or` evaluate both
 * sides before testing either, exactly as the C implementation does. No branch
 * can hide behind a short circuit that never happens.
 */
const WITNESS: TqlTask = { tags: [], priority: 0, title: '' };

export class QueryState {
	text = $state('');
	/** `tatr ls` hides closed tasks unless asked; so does this. */
	showClosed = $state(false);

	readonly #compiled = $derived.by(() => {
		const source = this.text.trim();
		if (source === '') {
			return { match: () => true, error: null as TqlError | null, warnings: [] as TqlWarning[] };
		}
		try {
			const match = compile(source);
			match(WITNESS);
			return { match, error: null, warnings: parseWithWarnings(source).warnings };
		} catch (error) {
			// An incomplete or ill-typed query is the normal state while typing, so
			// it filters nothing rather than emptying the screen under the reader.
			return {
				match: () => true,
				error: error instanceof TqlError ? error : null,
				warnings: [] as TqlWarning[]
			};
		}
	});

	get error(): TqlError | null {
		return this.#compiled.error;
	}

	get warnings(): TqlWarning[] {
		return this.#compiled.warnings;
	}

	/** Applies the query to a set of tasks, honouring the closed toggle. */
	apply(tasks: Task[]): Task[] {
		const pool = this.showClosed ? tasks : tasks.filter((task) => !task.closed);
		return this.#compiled.error ? pool : pool.filter((task) => this.#compiled.match(task));
	}

	/** Adds a term, or removes it when it is already the whole query. */
	toggle(term: string): void {
		const current = this.text.trim();
		if (current === term) {
			this.text = '';
			return;
		}
		if (current === '') {
			this.text = term;
			return;
		}
		const parts = current.split(/\s+and\s+/);
		this.text = parts.includes(term)
			? parts.filter((part) => part !== term).join(' and ')
			: `${current} and ${term}`;
	}

	has(term: string): boolean {
		return this.text.trim().split(/\s+and\s+/).includes(term);
	}
}
