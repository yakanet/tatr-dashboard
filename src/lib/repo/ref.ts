/**
 * A reference to a repository that holds a `tasks/` folder.
 *
 * References round-trip through the site's own URLs, so that every repository
 * gets a unique, shareable address: `/{owner}/{name}`, optionally prefixed with
 * a forge host and suffixed with `@{branch}`.
 */
export type RepoRef = {
	/** Forge host, e.g. `github.com`. */
	host: string;
	owner: string;
	name: string;
	/** `undefined` means "whatever the forge reports as the default branch". */
	branch?: string;
};

export const DEFAULT_HOST = 'github.com';

/** GitHub allows these characters in owner and repository names. */
const SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * A leading path segment is a forge host rather than an owner when it looks like
 * a domain. This is unambiguous because forge account names cannot contain dots,
 * even though repository names can (e.g. `sveltejs/svelte.dev`).
 */
function isHost(segment: string): boolean {
	return segment.includes('.') && !segment.startsWith('.') && !segment.endsWith('.');
}

function cleanName(name: string): string {
	return name.replace(/\.git$/, '');
}

function build(host: string, owner: string, name: string, branch?: string): RepoRef | null {
	const cleaned = cleanName(name);
	if (!SEGMENT.test(owner) || !SEGMENT.test(cleaned)) return null;
	return branch ? { host, owner, name: cleaned, branch } : { host, owner, name: cleaned };
}

/**
 * Parses the `[...repo]` portion of one of our own URLs.
 *
 * Accepts `owner/name`, `host/owner/name`, and either form suffixed with
 * `@branch`. Branch names may contain slashes.
 */
export function parseRepoPath(path: string): RepoRef | null {
	const trimmed = path.replace(/^\/+|\/+$/g, '');
	if (!trimmed) return null;

	const at = trimmed.indexOf('@');
	const branch = at === -1 ? undefined : trimmed.slice(at + 1) || undefined;
	const segments = (at === -1 ? trimmed : trimmed.slice(0, at)).split('/').filter(Boolean);

	const host = segments.length > 2 && isHost(segments[0]) ? segments.shift()! : DEFAULT_HOST;
	if (segments.length !== 2) return null;

	return build(host, segments[0], segments[1], branch);
}

/**
 * Parses whatever a user pastes into the repository picker: a browser URL, an
 * SSH remote, or the bare `owner/name` shorthand.
 *
 * A GitHub tree URL carries its branch, so `/owner/name/tree/dev/tasks` resolves
 * to branch `dev`.
 */
export function parseRepoInput(input: string): RepoRef | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
		let url: URL;
		try {
			url = new URL(trimmed);
		} catch {
			return null;
		}
		return fromHostAndPath(url.hostname, url.pathname);
	}

	// `git@host:owner/name.git`, excluding anything that looks like a URL scheme.
	const ssh = /^(?:[\w.-]+@)?([\w.-]+\.[\w.-]+):(?!\/)(.+)$/.exec(trimmed);
	if (ssh) return fromHostAndPath(ssh[1], ssh[2]);

	return parseRepoPath(trimmed);
}

function fromHostAndPath(host: string, path: string): RepoRef | null {
	const segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
	if (segments.length < 2) return null;

	const [owner, name, keyword, ...rest] = segments;
	// GitHub, GitLab and Gitea all spell a branch view `/tree/<branch>/<path>`.
	// Branch and path are not separable there without asking the forge, so we take
	// the first segment: a pasted URL for a slash-containing branch loses its tail.
	// Our own `@branch` syntax has no such ambiguity.
	const branch = keyword === 'tree' && rest.length > 0 ? rest[0] : undefined;

	return build(host, owner, name, branch);
}

/** Renders a reference back into the path form used by our own URLs. */
export function formatRepoPath(ref: RepoRef): string {
	const prefix = ref.host === DEFAULT_HOST ? '' : `${ref.host}/`;
	const suffix = ref.branch ? `@${ref.branch}` : '';
	return `${prefix}${ref.owner}/${ref.name}${suffix}`;
}

/** Stable identity for caching, independent of the default-branch lookup. */
export function repoKey(ref: RepoRef): string {
	return `${ref.host}/${ref.owner}/${ref.name}@${ref.branch ?? ''}`;
}
