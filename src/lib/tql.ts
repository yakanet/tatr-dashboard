/**
 * TQL — the Tatr Query Language, as accepted by `tatr ls`.
 *
 * This is a faithful port of the reference implementation in `src/query.c`, so a
 * query copied from the shell behaves identically here. The grammar:
 *
 *     expr    ::= or
 *     or      ::= and *( 'or' and )
 *     and     ::= compare *( 'and' compare )
 *     compare ::= primary *( ('lt'|'le'|'gt'|'ge'|'eq'|'ne') primary )
 *     primary ::= ':' tag | '[' expr ']' | 'not' primary
 *               | 'any' | 'tagged' | 'priority' | number
 *
 * Square brackets group instead of parentheses, and comparisons are spelled as
 * words, so a query survives a shell without quoting.
 *
 * Evaluation is typed: `and`, `or` and `not` take booleans, the comparison
 * operators take integers, and the whole query must yield a boolean. Type errors
 * are reported at the offending token rather than silently coerced.
 */

/** A half-open range into the query source, used to point diagnostics at a token. */
export interface Span {
	start: number;
	end: number;
}

export type BinaryOp = 'and' | 'or' | 'lt' | 'le' | 'gt' | 'ge' | 'eq' | 'ne';

export type Node =
	| { kind: 'tag'; name: string; span: Span }
	| { kind: 'any'; span: Span }
	| { kind: 'tagged'; span: Span }
	| { kind: 'priority'; span: Span }
	| { kind: 'integer'; value: number; span: Span }
	| { kind: 'not'; operand: Node; span: Span }
	| { kind: 'binary'; op: BinaryOp; left: Node; right: Node; span: Span };

/** The task fields a query can see. */
export interface TqlTask {
	readonly tags: readonly string[];
	readonly priority: number;
}

export class TqlError extends Error {
	readonly span: Span;

	constructor(message: string, span: Span) {
		super(message);
		this.name = 'TqlError';
		this.span = span;
	}
}

/** A parse that succeeded but used deprecated syntax. */
export interface TqlWarning {
	message: string;
	span: Span;
}

export interface ParseResult {
	node: Node;
	warnings: TqlWarning[];
}

const COMPARISONS: Record<string, BinaryOp> = {
	lt: 'lt',
	le: 'le',
	gt: 'gt',
	ge: 'ge',
	eq: 'eq',
	ne: 'ne'
};

interface Token {
	text: string;
	span: Span;
}

/**
 * Splits a query into tokens. Brackets are single-character tokens; everything
 * else runs until a bracket or whitespace, which is why tags may not contain
 * either.
 */
export function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;

	while (i < source.length) {
		if (/\s/.test(source[i])) {
			i += 1;
			continue;
		}
		if (source[i] === '[' || source[i] === ']') {
			tokens.push({ text: source[i], span: { start: i, end: i + 1 } });
			i += 1;
			continue;
		}
		const start = i;
		while (i < source.length && !/[\s[\]]/.test(source[i])) i += 1;
		tokens.push({ text: source.slice(start, i), span: { start, end: i } });
	}

	return tokens;
}

/** Parses a query, returning its syntax tree. Throws {@link TqlError}. */
export function parse(source: string): Node {
	return parseWithWarnings(source).node;
}

/** Like {@link parse}, but also reports deprecated syntax rather than hiding it. */
export function parseWithWarnings(source: string): ParseResult {
	const tokens = tokenize(source);
	const warnings: TqlWarning[] = [];
	let pos = 0;

	const eof = (): Span => ({ start: source.length, end: source.length });
	const peek = (): Token | undefined => tokens[pos];
	const next = (): Token | undefined => tokens[pos++];

	function primary(): Node {
		const token = next();
		if (!token) throw new TqlError('Expected an expression', eof());

		// `.tag` predates `:tag` and is still accepted by the reference parser.
		if (token.text.startsWith(':') || token.text.startsWith('.')) {
			if (token.text.startsWith('.')) {
				warnings.push({
					message: 'Using `.` to refer to tags is deprecated. Use `:` instead.',
					span: token.span
				});
			}
			if (token.text.length === 1) throw new TqlError('Empty tag', token.span);
			return { kind: 'tag', name: token.text.slice(1), span: token.span };
		}

		if (token.text === '[') {
			const inner = expression();
			const closing = next();
			if (!closing || closing.text !== ']') {
				throw new TqlError('Expected `]`', closing ? closing.span : eof());
			}
			return inner;
		}

		if (token.text === ']') throw new TqlError('Unexpected `]`', token.span);

		// `not` binds to a primary, so `not :a and :b` means `[not :a] and :b`.
		if (token.text === 'not') {
			const operand = primary();
			return { kind: 'not', operand, span: token.span };
		}

		if (token.text === 'any') return { kind: 'any', span: token.span };
		if (token.text === 'tagged') return { kind: 'tagged', span: token.span };
		if (token.text === 'priority') return { kind: 'priority', span: token.span };

		if (/^-?\d+$/.test(token.text)) {
			return { kind: 'integer', value: Number.parseInt(token.text, 10), span: token.span };
		}

		throw new TqlError(`Unknown token \`${token.text}\``, token.span);
	}

	function comparison(): Node {
		let left = primary();
		for (;;) {
			const token = peek();
			const op = token && COMPARISONS[token.text];
			if (!op) return left;
			pos += 1;
			const right = primary();
			left = { kind: 'binary', op, left, right, span: token!.span };
		}
	}

	function conjunction(): Node {
		let left = comparison();
		while (peek()?.text === 'and') {
			const token = next()!;
			const right = comparison();
			left = { kind: 'binary', op: 'and', left, right, span: token.span };
		}
		return left;
	}

	function expression(): Node {
		let left = conjunction();
		while (peek()?.text === 'or') {
			const token = next()!;
			const right = conjunction();
			left = { kind: 'binary', op: 'or', left, right, span: token.span };
		}
		return left;
	}

	const node = expression();

	const trailing = peek();
	if (trailing) {
		throw new TqlError(`Unexpected token \`${trailing.text}\``, trailing.span);
	}

	return { node, warnings };
}

type Value = { type: 'boolean'; value: boolean } | { type: 'integer'; value: number };

function expect(value: Value, type: 'boolean' | 'integer', span: Span): Value {
	if (value.type !== type) {
		throw new TqlError(`Expected ${type} but got ${value.type}`, span);
	}
	return value;
}

function evaluateNode(node: Node, task: TqlTask): Value {
	switch (node.kind) {
		case 'any':
			return { type: 'boolean', value: true };
		case 'tagged':
			return { type: 'boolean', value: task.tags.length > 0 };
		case 'tag':
			return { type: 'boolean', value: task.tags.includes(node.name) };
		case 'priority':
			return { type: 'integer', value: task.priority };
		case 'integer':
			return { type: 'integer', value: node.value };
		case 'not': {
			const operand = expect(evaluateNode(node.operand, task), 'boolean', node.operand.span);
			return { type: 'boolean', value: !operand.value };
		}
		case 'binary': {
			const left = evaluateNode(node.left, task);
			const right = evaluateNode(node.right, task);

			if (node.op === 'and' || node.op === 'or') {
				const a = expect(left, 'boolean', node.left.span).value as boolean;
				const b = expect(right, 'boolean', node.right.span).value as boolean;
				return { type: 'boolean', value: node.op === 'and' ? a && b : a || b };
			}

			const a = expect(left, 'integer', node.left.span).value as number;
			const b = expect(right, 'integer', node.right.span).value as number;
			switch (node.op) {
				case 'lt':
					return { type: 'boolean', value: a < b };
				case 'le':
					return { type: 'boolean', value: a <= b };
				case 'gt':
					return { type: 'boolean', value: a > b };
				case 'ge':
					return { type: 'boolean', value: a >= b };
				case 'eq':
					return { type: 'boolean', value: a === b };
				case 'ne':
					return { type: 'boolean', value: a !== b };
			}
		}
	}
}

/** Evaluates a parsed query against one task. Throws {@link TqlError} on a type error. */
export function evaluate(node: Node, task: TqlTask): boolean {
	const result = evaluateNode(node, task);
	if (result.type !== 'boolean') {
		throw new TqlError(`Expected boolean but got ${result.type}`, node.span);
	}
	return result.value;
}

/**
 * Parses once and returns a predicate. Prefer this when filtering a list, so the
 * query is not re-parsed per task.
 */
export function compile(source: string): (task: TqlTask) => boolean {
	const node = parse(source);
	return (task) => evaluate(node, task);
}

/**
 * Renders an error the way the CLI does: the source, a caret under the offending
 * token, then the message.
 */
export function formatDiagnostic(source: string, error: TqlError): string {
	const caret = ' '.repeat(error.span.start) + '^'.repeat(Math.max(1, error.span.end - error.span.start));
	return `${source}\n${caret}\n${error.message}`;
}
