/**
 * The GitHub API, as one lister.
 *
 * One call to the git trees API returns the entire repository tree, so listing
 * a repository costs exactly one request out of the 60 per hour an
 * unauthenticated IP gets. `HEAD` is accepted as the reference, including on
 * repositories whose default branch is not `main`, which halves that: one
 * request per repository, never two.
 *
 * Measured: a conditional request answering 304 still consumes quota when
 * unauthenticated, so revalidating is not free and the cache is never
 * refreshed behind the reader's back.
 */
import type { RepoRef } from '../../repo/ref.ts';
import { ProviderError, type Provider } from '../provider.ts';

const API = 'https://api.github.com';
const NAME = 'github';

interface TreeResponse {
	tree?: { path: string; type: string; size?: number }[];
	truncated?: boolean;
}

async function json(url: string, signal?: AbortSignal): Promise<Response> {
	let response: Response;
	try {
		response = await fetch(url, {
			signal,
			headers: { Accept: 'application/vnd.github+json' }
		});
	} catch {
		throw new ProviderError('network', NAME, `Could not reach ${url}`);
	}

	if (response.status === 403 || response.status === 429) {
		const remaining = response.headers.get('x-ratelimit-remaining');
		if (remaining === '0' || response.status === 429) {
			throw new ProviderError('rate-limited', NAME, 'GitHub API rate limit reached');
		}
	}
	if (response.status === 404) {
		throw new ProviderError('not-found', NAME, 'Repository or branch not found');
	}
	if (!response.ok) {
		throw new ProviderError('network', NAME, `GitHub answered ${response.status}`);
	}
	return response;
}

export const github: Provider = {
	name: NAME,

	async list(ref, signal) {
		// `HEAD` avoids a second request to learn the default branch's name.
		const branch = ref.branch ?? 'HEAD';
		const response = await json(
			`${API}/repos/${ref.owner}/${ref.name}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
			signal
		);
		const body = (await response.json()) as TreeResponse;
		if (!Array.isArray(body.tree)) {
			throw new ProviderError('malformed', NAME, 'No tree in the response');
		}
		if (body.truncated) {
			throw new ProviderError(
				'malformed',
				NAME,
				'Repository tree is truncated; it is too large to list in one call'
			);
		}

		return {
			entries: body.tree
				.filter((entry) => entry.type === 'blob')
				.map((entry) => (entry.size === undefined ? { path: entry.path } : { path: entry.path, size: entry.size })),
			source: NAME,
			mayBeStale: false,
			branch
		};
	}
};
