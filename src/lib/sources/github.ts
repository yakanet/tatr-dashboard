/**
 * GitHub as the primary provider.
 *
 * One call to the git trees API returns the entire repository tree, so listing a
 * repository costs exactly one request out of the 60 per hour an unauthenticated
 * IP gets. File contents are read from raw.githubusercontent.com, which is a CDN
 * and sends no rate-limit headers at all — 64 files fetched in parallel came back
 * in a fifth of a second when measured.
 *
 * Both endpoints accept `HEAD` as the reference, including on repositories whose
 * default branch is not `main`, so resolving the default branch is unnecessary.
 * That halves what listing costs: one request per repository, never two.
 *
 * Measured: a conditional request answering 304 still consumes quota when
 * unauthenticated, so revalidation is not free and caching is done on a TTL.
 */
import type { RepoRef } from '../repo/ref.ts';
import { ProviderError, assertGitHub, type Listing, type Provider } from './provider.ts';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
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

/**
 * Resolves the default branch by name. Not needed to read a repository — `HEAD`
 * works for that — so this costs a request and is only worth calling to *display*
 * the branch.
 */
export async function defaultBranch(ref: RepoRef, signal?: AbortSignal): Promise<string> {
	assertGitHub(ref, NAME);
	const response = await json(`${API}/repos/${ref.owner}/${ref.name}`, signal);
	const body = (await response.json()) as { default_branch?: string };
	if (!body.default_branch) {
		throw new ProviderError('malformed', NAME, 'No default branch in the response');
	}
	return body.default_branch;
}

export const github: Provider = {
	name: NAME,

	async list(ref, signal) {
		assertGitHub(ref, NAME);
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

/**
 * Encodes a path one segment at a time, so the slashes between them survive.
 *
 * Branches take the same treatment as paths, and for the same reason: a URL
 * carries `feature/web-ui` as two segments, and `feature%2Fweb-ui` is a branch
 * of that literal name, which no repository has.
 */
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** URL of a file's raw contents. Free of the API budget. */
export function rawUrl(ref: RepoRef, branch: string, path: string): string {
	return `${RAW}/${ref.owner}/${ref.name}/${encodePath(branch)}/${encodePath(path)}`;
}

/**
 * A file's page on the forge, where its history and its blame are.
 *
 * This viewer computes no history, and the link is how it gets away with that:
 * the format holds no modification date, and dating tasks through the API costs
 * one request per task against sixty an hour. The forge renders history better
 * than we would anyway, so a reader who wants it is handed over rather than
 * served a guess.
 *
 * `ref.host` rather than a constant, this being the one URL that genuinely
 * lives on the forge's own domain. The path shape is still GitHub's — GitLab
 * spells it `/-/blob/` — which is 20260906-211255's problem, not this one's.
 */
export function blobUrl(ref: RepoRef, branch: string, path: string): string {
	return `https://${ref.host}/${ref.owner}/${ref.name}/blob/${encodePath(branch)}/${encodePath(path)}`;
}
