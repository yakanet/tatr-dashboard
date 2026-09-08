/**
 * A provider is one way of listing a repository's files.
 *
 * A forge owns an ordered list of them and falls through it, so this is the
 * vocabulary that list shares — the entries, the failures, and nothing about
 * whose repository it is. Which host a provider serves, and whether reading
 * from it costs anything, are facts about the forge and live with it.
 */
import type { RepoRef } from '../repo/ref.ts';

export interface TreeEntry {
	/** Path from the repository root, e.g. `tasks/20260826-200847/TASK.md`. */
	path: string;
	/** Size in bytes, when the source reports one. */
	size?: number;
}

export interface Listing {
	entries: TreeEntry[];
	/** Branch the listing was taken from, once resolved. */
	branch: string;
}

export interface Provider {
	/** Lists every file in the repository. Throws {@link ProviderError} on failure. */
	list(ref: RepoRef, signal?: AbortSignal): Promise<Listing>;
}

export type ProviderFailure =
	'rate-limited' | 'not-found' | 'network' | 'unsupported-host' | 'malformed';

export class ProviderError extends Error {
	readonly failure: ProviderFailure;
	readonly source: string;

	constructor(failure: ProviderFailure, source: string, message: string) {
		super(message);
		this.name = 'ProviderError';
		this.failure = failure;
		this.source = source;
	}
}
