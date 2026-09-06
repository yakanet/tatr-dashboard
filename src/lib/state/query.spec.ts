import { describe, expect, it } from 'vitest';
import { matchesTitle, QueryState } from './query.svelte.ts';
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

const titled = (title: string): Task =>
	readTask('20260101-000009', `# ${title}\n\n- STATUS: OPEN\n`)!;

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

describe('matchesTitle', () => {
	it('ignores case', () => {
		expect(matchesTitle('Windows support', 'windows')).toBe(true);
	});

	it('matches inside a word', () => {
		expect(matchesTitle('Windows support', 'ndows')).toBe(true);
	});

	it('wants every word, in any order', () => {
		expect(matchesTitle('Windows support', 'support windows')).toBe(true);
		expect(matchesTitle('Windows support', 'windows linux')).toBe(false);
	});

	it('ignores the spacing between words', () => {
		expect(matchesTitle('Windows support', '  windows   support ')).toBe(true);
	});

	it('matches everything when there is nothing to match', () => {
		expect(matchesTitle('Windows support', '   ')).toBe(true);
	});
});

describe('the text filter beside the query', () => {
	it('narrows the query rather than replacing it', () => {
		const query = new QueryState();
		query.text = ':bug';
		query.search = 'windows';
		expect(query.apply([titled('Windows support'), ...tasks])).toEqual([]);
	});

	it('filters on its own with no query at all', () => {
		const query = new QueryState();
		query.search = 'windows';
		expect(query.apply([titled('Windows support'), ...tasks]).map((t) => t.title)).toEqual([
			'Windows support'
		]);
	});

	it('still hides closed tasks unless asked', () => {
		const query = new QueryState();
		query.search = 't';
		expect(query.apply(tasks)).toHaveLength(2);
		query.showClosed = true;
		expect(query.apply(tasks)).toHaveLength(3);
	});
});
