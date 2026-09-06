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

/** Formats an instant as a HUID, the way `tatr new` does. */
export function formatHuid(date: Date, suffix?: string): string {
	const pad = (n: number, width = 2) => String(n).padStart(width, '0');
	const stamp =
		`${pad(date.getUTCFullYear(), 4)}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
		`-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
	return suffix ? `${stamp}-${suffix}` : stamp;
}
