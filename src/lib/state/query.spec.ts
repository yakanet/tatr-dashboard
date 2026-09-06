import { describe, expect, it } from 'vitest';
import { QueryState } from './query.svelte.ts';
import { readTask, type Task } from '../tatr/task.ts';

const make = (id: string, priority: number, tags: string[], closed = false): Task =>
	readTask(
		id,
		`# t\n\n- STATUS: ${closed ? 'CLOSED' : 'OPEN'}\n- PRIORITY: ${priority}\n- TAGS: ${tags.join(',')}\n`
	)!;

const tasks = [
	make('20260101-000001', 100, ['bug']),
	make('20260101-000002', 50, []),
	make('20260101-000003', 100, ['bug'], true)
];

const withText = (text: string) => {
	const query = new QueryState();
	query.text = text;
	return query;
};

describe('QueryState', () => {
	it('matches everything when empty', () => {
		expect(withText('').apply(tasks)).toHaveLength(2);
	});

	it('filters on a tag', () => {
		expect(withText(':bug').apply(tasks).map((task) => task.id)).toEqual(['20260101-000001']);
	});

	it('honours the closed toggle', () => {
		const query = withText(':bug');
		query.showClosed = true;
		expect(query.apply(tasks)).toHaveLength(2);
	});

	it('reports a syntax error rather than filtering', () => {
		const query = withText('pr');
		expect(query.error?.message).toBe('Unknown token `pr`');
		expect(query.apply(tasks)).toHaveLength(2);
	});

	// `priority` parses and compiles: it is an integer where a boolean is
	// required, and the language only says so while evaluating. Left unchecked it
	// threw mid-render and took the page down with it.
	it.each(['priority', '100', 'priority and :bug'])(
		'reports the ill-typed query %o instead of throwing',
		(source) => {
			const query = withText(source);
			expect(query.error?.message).toContain('Expected boolean');
			expect(() => query.apply(tasks)).not.toThrow();
			expect(query.apply(tasks)).toHaveLength(2);
		}
	);

	it('still reports a type error hiding on the right of an and', () => {
		// `and` evaluates both sides before testing either, so no branch escapes
		// the witness — even one a short-circuiting language would skip.
		expect(withText(':bug and priority').error?.message).toContain('Expected boolean');
	});

	it('keeps a deprecated spelling working, with a warning', () => {
		const query = withText('.bug');
		expect(query.error).toBeNull();
		expect(query.warnings).toHaveLength(1);
		expect(query.apply(tasks)).toHaveLength(1);
	});
});
