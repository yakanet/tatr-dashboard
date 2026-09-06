/**
 * A provider lists the task folders of a repository and reads files from it.
 *
 * Listing is the only operation that can be rate-limited, so it is deliberately
 * separated from reading: contents always come from a CDN that imposes no budget.
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
	/** Which provider answered, so the UI can say when data may be stale. */
	source: string;
	/** True when the provider is known to serve a cached, possibly late, view. */
	mayBeStale: boolean;
	/** Branch the listing was taken from, once resolved. */
	branch: string;
}

export interface Provider {
	readonly name: string;
	/** Lists every file in the repository. Throws {@link ProviderError} on failure. */
	list(ref: RepoRef, signal?: AbortSignal): Promise<Listing>;
}

export type ProviderFailure =
	| 'rate-limited'
	| 'not-found'
	| 'network'
	| 'unsupported-host'
	| 'malformed';

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

/** Only GitHub is implemented; the URL scheme already carries other hosts. */
export function assertGitHub(ref: RepoRef, source: string): void {
	if (ref.host !== 'github.com') {
		throw new ProviderError(
			'unsupported-host',
			source,
			`${ref.host} is not supported yet — only github.com`
		);
	}
}
