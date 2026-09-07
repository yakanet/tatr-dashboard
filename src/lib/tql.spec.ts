import { describe, expect, it } from 'vitest';
import {
	TqlError,
	compile,
	evaluate,
	formatDiagnostic,
	parse,
	parseWithWarnings,
	tokenize,
	matchesTitle,
	type TqlTask
} from './tql.ts';

const task = (tags: string[], priority = 100, title = 'A task'): TqlTask => ({
	tags,
	priority,
	title
});

const bug = task(['bug'], 100);
const bugUi = task(['bug', 'ui'], 30);
const untagged = task([], 100);

/** Evaluates a source query against one task, the way a filter would. */
const run = (source: string, t: TqlTask) => evaluate(parse(source), t);

describe('tokenize', () => {
	it('treats brackets as their own tokens', () => {
		expect(tokenize('[:a or :b]').map((t) => t.text)).toEqual(['[', ':a', 'or', ':b', ']']);
	});

	it('does not require whitespace around brackets', () => {
		expect(tokenize('not[:a]').map((t) => t.text)).toEqual(['not', '[', ':a', ']']);
	});

	it('reports positions so diagnostics can point at a token', () => {
		expect(tokenize('  :bug')[0].span).toEqual({ start: 2, end: 6 });
	});

	it('returns nothing for blank input', () => {
		expect(tokenize('   ')).toEqual([]);
	});
});

describe('the README examples', () => {
	it.each([
		[':bug', bug, true],
		[':bug', untagged, false],
		[':bug and not :ui', bug, true],
		[':bug and not :ui', bugUi, false],
		['not tagged', untagged, true],
		['not tagged', bug, false],
		[':bug and priority lt 50', bugUi, true],
		[':bug and priority lt 50', bug, false]
	])('%o matches as documented', (source, t, expected) => {
		expect(run(source as string, t as TqlTask)).toBe(expected);
	});
});

describe('primaries', () => {
	it('any is always true', () => {
		expect(run('any', untagged)).toBe(true);
	});

	it('tagged reflects whether the task carries any tag', () => {
		expect(run('tagged', bug)).toBe(true);
		expect(run('tagged', untagged)).toBe(false);
	});

	it('accepts the deprecated dot syntax, with a warning', () => {
		const { warnings } = parseWithWarnings('.bug');
		expect(warnings).toHaveLength(1);
		expect(warnings[0].message).toContain('deprecated');
		expect(run('.bug', bug)).toBe(true);
	});

	it('does not warn for the current syntax', () => {
		expect(parseWithWarnings(':bug').warnings).toEqual([]);
	});

	it('reads negative integers', () => {
		expect(run('priority gt -1', task([], -5))).toBe(false);
		expect(run('priority eq -5', task([], -5))).toBe(true);
	});
});

describe('precedence', () => {
	it('binds and tighter than or', () => {
		// Parsed as `:a or [:b and :c]`, so a task with only `a` matches.
		expect(run(':a or :b and :c', task(['a']))).toBe(true);
	});

	it('binds not to a primary only', () => {
		// `not :a and :b` is `[not :a] and :b`, not `not [:a and :b]`.
		expect(run('not :a and :b', task(['b']))).toBe(true);
		expect(run('not :a and :b', task(['a', 'b']))).toBe(false);
	});

	it('groups with square brackets', () => {
		expect(run('not [:a and :b]', task(['a']))).toBe(true);
		expect(run('[:a or :b] and :c', task(['a', 'c']))).toBe(true);
		expect(run('[:a or :b] and :c', task(['a']))).toBe(false);
	});

	it('nests groups', () => {
		expect(run('[[:a or :b] and :c] or :d', task(['d']))).toBe(true);
	});

	it('stacks not', () => {
		expect(run('not not :a', task(['a']))).toBe(true);
	});
});

describe('comparisons', () => {
	it.each([
		['priority lt 100', 50, true],
		['priority lt 100', 100, false],
		['priority le 100', 100, true],
		['priority gt 100', 110, true],
		['priority ge 100', 100, true],
		['priority eq 100', 100, true],
		['priority ne 100', 100, false]
	])('%o against priority %i', (source, priority, expected) => {
		expect(run(source as string, task([], priority as number))).toBe(expected);
	});

	it('compares two literals', () => {
		expect(run('1 lt 2', untagged)).toBe(true);
	});

	it('combines with logic', () => {
		expect(run('priority ge 100 and not :wontfix', task(['bug'], 110))).toBe(true);
		expect(run('priority ge 100 and not :wontfix', task(['wontfix'], 110))).toBe(false);
	});
});

describe('errors', () => {
	const fails = (source: string) => {
		try {
			parse(source);
		} catch (error) {
			return error as TqlError;
		}
		return null;
	};

	it('rejects an empty tag', () => {
		expect(fails(':')?.message).toBe('Empty tag');
	});

	it('rejects an empty query', () => {
		expect(fails('')?.message).toBe('Expected an expression');
	});

	it('rejects an unclosed group', () => {
		expect(fails('[:a')?.message).toBe('Expected `]`');
	});

	it('rejects a stray closing bracket', () => {
		expect(fails(':a]')?.message).toContain('Unexpected infix operator');
	});

	it('rejects an unknown word', () => {
		expect(fails('bug')?.message).toBe('Unknown token `bug`');
	});

	it('rejects a dangling operator', () => {
		expect(fails(':a and')?.message).toBe('Expected an expression');
	});

	it('points at the offending token', () => {
		expect(fails(':a and nope')?.span).toEqual({ start: 7, end: 11 });
	});

	it('rejects comparing booleans, as the reference parser does', () => {
		const error = (() => {
			try {
				run(':a lt 5', bug);
			} catch (e) {
				return e as TqlError;
			}
		})();
		expect(error?.message).toBe('Expected integer but got boolean');
	});

	it('rejects a query that yields an integer', () => {
		const error = (() => {
			try {
				run('priority', bug);
			} catch (e) {
				return e as TqlError;
			}
		})();
		expect(error?.message).toBe('Expected boolean but got integer');
	});

	it('rejects logic over integers', () => {
		const error = (() => {
			try {
				run('priority and :a', bug);
			} catch (e) {
				return e as TqlError;
			}
		})();
		expect(error?.message).toBe('Expected boolean but got integer');
	});
});

describe('formatDiagnostic', () => {
	it('underlines the offending token', () => {
		const source = ':a and nope';
		try {
			parse(source);
			expect.unreachable('should have thrown');
		} catch (error) {
			expect(formatDiagnostic(source, error as TqlError)).toBe(
				':a and nope\n       ^\nUnknown token `nope`'
			);
		}
	});
});

describe('compile', () => {
	it('parses once and filters many', () => {
		const matches = compile(':bug and not :wontfix');
		const tasks = [task(['bug']), task(['bug', 'wontfix']), task(['ui'])];
		expect(tasks.filter(matches)).toHaveLength(1);
	});

	it('throws at compile time, not per task', () => {
		expect(() => compile(':a and')).toThrow(TqlError);
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
});

describe('the ~ term', () => {
	const windows = task([], 100, 'Windows support');
	const macos = task([], 100, 'MacOS support');
	const run = (source: string, on: TqlTask) => compile(source)(on);

	it('reads a bare word', () => {
		expect(run('~windows', windows)).toBe(true);
		expect(run('~windows', macos)).toBe(false);
	});

	it('reads a quoted phrase as one token, spaces and all', () => {
		expect(tokenize('~"windows support"').map((t) => t.text)).toEqual(['~"windows support"']);
		expect(run('~"support windows"', windows)).toBe(true);
	});

	it('composes like any other primary', () => {
		expect(run('~windows or ~macos', macos)).toBe(true);
		expect(run('not ~windows', macos)).toBe(true);
		expect(run('[~windows or ~macos] and priority ge 100', windows)).toBe(true);
	});

	it('is a boolean, so a comparison rejects it', () => {
		expect(() => run('priority eq ~x', windows)).toThrow(TqlError);
	});

	it('refuses a bare ~', () => {
		expect(() => parse('~')).toThrow('Expected a word or a quoted phrase after `~`');
	});

	it('refuses an unterminated quote, which is how typing looks halfway', () => {
		expect(() => parse('~"windows sup')).toThrow('Unterminated quote');
		expect(() => parse('~"')).toThrow('Unterminated quote');
	});

	it('refuses a phrase with nothing in it', () => {
		expect(() => parse('~"  "')).toThrow('Empty search');
	});

	it('leaves a quote alone where the language has no use for one', () => {
		// Nothing in the C grammar spells a string, so this stays an unknown token
		// rather than quietly becoming a search.
		expect(() => parse('"windows"')).toThrow('Unknown token');
	});
});

describe('two primaries with nothing between them', () => {
	// The reference implementation answers this with the list of operators that
	// could have filled the gap, above its usual caret. It also calls the token an
	// infix operator, even for `not`, and the wording is ported as it stands.
	it('names it the way the CLI does', () => {
		expect(() => parse('~support not ~mac')).toThrow('Unexpected infix operator `not`');
		expect(() => parse(':bug not :ui')).toThrow('Unexpected infix operator `not`');
	});

	it('carries the operator list into the rendered diagnostic', () => {
		let error: unknown;
		try {
			parse(':bug not :ui');
		} catch (thrown) {
			error = thrown;
		}
		const rendered = formatDiagnostic(':bug not :ui', error as TqlError);
		expect(rendered).toBe(
			[
				'Supported infix operators:',
				'',
				'    and  or                  - logical operators',
				'    lt  le  gt  ge  eq  ne   - comparison operators',
				'',
				':bug not :ui',
				'     ^',
				'Unexpected infix operator `not`'
			].join('\n')
		);
	});

	it('leaves every other diagnostic without help', () => {
		let error: unknown;
		try {
			parse('priority lt');
		} catch (thrown) {
			error = thrown;
		}
		expect((error as TqlError).help).toBeUndefined();
		expect(formatDiagnostic('priority lt', error as TqlError)).toBe(
			'priority lt\n           ^\nExpected an expression'
		);
	});
});
