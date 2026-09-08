/**
 * The query, shared by every view of a repository.
 *
 * It is global state on purpose: the dashboard's charts are both a
 * visualisation and a control, so clicking a tag bar has to filter the list,
 * the counts and the other charts at once. Keeping it in the URL means a
 * filtered view is a link someone can send.
 */
import { compile, parseWithWarnings, TqlError, type TqlWarning } from '../tql/query.ts';
import type { Task } from '../tatr/task.ts';

export const QUERY = Symbol('query');

export class QueryState {
	text = $state('');
	/** `tatr ls` hides closed tasks unless asked; so does this. */
	showClosed = $state(false);

	readonly #compiled = $derived.by(() => {
		const source = this.text.trim();
		if (source === '') {
			return {
				source,
				match: () => true,
				error: null as TqlError | null,
				warnings: [] as TqlWarning[]
			};
		}
		try {
			return {
				source,
				match: compile(source),
				error: null,
				warnings: parseWithWarnings(source).warnings
			};
		} catch (error) {
			// An incomplete or ill-typed query is the normal state while typing, so
			// it filters nothing rather than emptying the screen under the reader.
			return {
				source,
				match: () => true,
				error: error instanceof TqlError ? error : null,
				warnings: [] as TqlWarning[]
			};
		}
	});

	/**
	 * The query as it was compiled, which is what an error's columns count from.
	 *
	 * Whoever renders a diagnostic gets handed this rather than `text`: the two
	 * differ by the trim, and printing the untrimmed line above a caret measured
	 * on the trimmed one slid the source right and left the caret pointing at
	 * nothing — leading spaces being invisible, the reader saw a caret accusing
	 * a character several columns from the one it meant.
	 */
	get source(): string {
		return this.#compiled.source;
	}

	get error(): TqlError | null {
		return this.#compiled.error;
	}

	get warnings(): TqlWarning[] {
		return this.#compiled.warnings;
	}

	/**
	 * Whether one task satisfies the query, ignoring the closed toggle.
	 *
	 * The board needs the two apart: its Done column *is* the closed tasks, so
	 * filtering them out before the columns are built would empty it rather than
	 * narrow it. An unparsable query matches everything, so a half-typed one
	 * leaves the screen alone instead of blanking it.
	 */
	matches(task: Task): boolean {
		return this.#compiled.error ? true : this.#compiled.match(task);
	}

	/** Applies the query to a set of tasks, honouring the closed toggle. */
	apply(tasks: Task[]): Task[] {
		const pool = this.showClosed ? tasks : tasks.filter((task) => !task.closed);
		return pool.filter((task) => this.matches(task));
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
		return this.text
			.trim()
			.split(/\s+and\s+/)
			.includes(term);
	}
}
