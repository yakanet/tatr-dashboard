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
const WITNESS: TqlTask = { tags: [], priority: 0 };

/**
 * Whether a title matches a plain-text filter.
 *
 * Every word has to appear, in any order and in any position, so "support
 * windows" finds "Windows support" — which typing the words in the wrong order
 * otherwise would not. Case is ignored; nothing else is normalised, because the
 * titles this reads are shown verbatim and a reader is matching what they see.
 */
export function matchesTitle(title: string, search: string): boolean {
	const words = search.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;

	const haystack = title.toLowerCase();
	return words.every((word) => haystack.includes(word));
}

export class QueryState {
	text = $state('');
	/**
	 * A plain-text filter on titles, kept out of the query language on purpose.
	 *
	 * TQL sees a task's tags and priority and nothing else, exactly as the CLI's
	 * does, and a query copied from a shell has to keep working here. Growing an
	 * operator for text would break that in one direction — ours would no longer
	 * run there — so text filtering sits beside the language rather than inside
	 * it, and the two combine with an implicit `and`.
	 */
	search = $state('');
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

	/** Applies both filters to a set of tasks, honouring the closed toggle. */
	apply(tasks: Task[]): Task[] {
		const pool = this.showClosed ? tasks : tasks.filter((task) => !task.closed);
		const found = this.#compiled.error
			? pool
			: pool.filter((task) => this.#compiled.match(task));

		const search = this.search.trim();
		return search === '' ? found : found.filter((task) => matchesTitle(task.title, search));
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
