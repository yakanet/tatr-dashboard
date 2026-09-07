/**
 * HUID — Human-Unique IDentifier, the name of a task folder.
 *
 * The format is `YYYYMMDD-HHMMSS` in UTC, optionally followed by `-` and a
 * suffix of alphanumerics and dashes, which teams use to keep ids unique when
 * they generate them in parallel branches.
 *
 * Because the id *is* a timestamp, every task has a creation date without a
 * single extra request. Ported from `src/huid.c`.
 */

const HUID = /^(\d{8})-(\d{6})(?:-([A-Za-z0-9-]*))?$/;

export interface Huid {
	/** The full id, as it appears on disk. */
	id: string;
	/** Creation instant, read as UTC. */
	created: Date;
	/** The optional team suffix, without its leading dash. */
	suffix?: string;
}

/** Whether a folder name is a task id. Non-matching entries are skipped, not errors. */
export function isValidHuid(id: string): boolean {
	return parseHuid(id) !== null;
}

/**
 * Parses a task id. Returns `null` when the name is not a HUID, or when its
 * digits do not form a real instant (`20260231-000000`, say).
 */
export function parseHuid(id: string): Huid | null {
	const match = HUID.exec(id);
	if (!match) return null;

	const [, date, time, suffix] = match;
	const year = Number(date.slice(0, 4));
	const month = Number(date.slice(4, 6));
	const day = Number(date.slice(6, 8));
	const hour = Number(time.slice(0, 2));
	const minute = Number(time.slice(2, 4));
	const second = Number(time.slice(4, 6));

	const created = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
	// Date.UTC rolls invalid components over, so round-trip to reject them.
	if (
		created.getUTCFullYear() !== year ||
		created.getUTCMonth() !== month - 1 ||
		created.getUTCDate() !== day ||
		created.getUTCHours() !== hour ||
		created.getUTCMinutes() !== minute ||
		created.getUTCSeconds() !== second
	) {
		return null;
	}

	return suffix ? { id, created, suffix } : { id, created };
}

const isDigit = (c: string) => c >= '0' && c <= '9';
const isAlnumOrDash = (c: string) =>
	c === '-' || (c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');

/**
 * Reads a HUID starting at `start`, returning the index just past it, or `-1`.
 *
 * A direct port of `chop_huid` in `src/huid.c`, whose shape matters more than it
 * looks: it recognises an id *anywhere*, with no word boundary, so a HUID glued
 * to the preceding word still counts. Its digit loops also stop at the end of
 * the text, so a truncated id at the very end is accepted — harmless, because
 * every caller then checks that the task exists.
 */
function chopHuid(text: string, start: number): number {
	let i = start;
	for (let n = 0; i < text.length && n < 8; n++) {
		if (!isDigit(text[i])) return -1;
		i++;
	}
	if (text[i] !== '-') return -1;
	i++;
	for (let n = 0; i < text.length && n < 6; n++) {
		if (!isDigit(text[i])) return -1;
		i++;
	}
	if (text[i] === '-') {
		while (i < text.length && isAlnumOrDash(text[i])) i++;
	}
	return i;
}

/** Where an id sits in the text it was read from: `[start, end)`. */
export interface HuidSpan {
	id: string;
	start: number;
	end: number;
}

/**
 * Every HUID appearing in a text, in order and with repeats, the way the
 * reference implementation scans a `TASK.md`: try to read an id at the cursor,
 * and advance by a single character when that fails.
 *
 * The positions come out with the ids because a renderer that turns an id into
 * a link has to know where to cut, and a second scan written for that would be
 * a second notion of what an id looks like.
 */
export function scanHuidSpans(text: string): HuidSpan[] {
	const found: HuidSpan[] = [];
	let i = 0;
	while (i < text.length) {
		const end = chopHuid(text, i);
		if (end === -1) {
			i += 1;
		} else {
			found.push({ id: text.slice(i, end), start: i, end });
			i = end;
		}
	}
	return found;
}

/** The same scan, for the callers that only care which ids are cited. */
export function scanHuids(text: string): string[] {
	return scanHuidSpans(text).map((span) => span.id);
}

/** Formats an instant as a HUID, the way `tatr new` does. */
export function formatHuid(date: Date, suffix?: string): string {
	const pad = (n: number, width = 2) => String(n).padStart(width, '0');
	const stamp =
		`${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
		`-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
	return suffix ? `${stamp}-${suffix}` : stamp;
}
