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
import { repoKey, type RepoRef } from '../repo/ref.ts';
import { ProviderError, assertGitHub, type Listing, type Provider } from './provider.ts';
import { jsdelivr } from './jsdelivr.ts';
import { ungh } from './ungh.ts';
import type { OpenOptions, Source, SourceKind } from './source.ts';

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

/**
 * The listers this forge falls back through, in order. GitHub first so the
 * normal path depends on nobody else; the other two are mirrors *of GitHub*,
 * which is why they belong to it rather than standing beside it as sources.
 */
export const PROVIDERS: Provider[] = [github, ungh, jsdelivr];

/**
 * Lists a repository, falling back through the listers in order.
 *
 * Only the listing can be rate-limited, so a spent budget is answered by asking
 * someone else rather than by an error. A missing repository is missing
 * everywhere, so that one is not retried.
 */
export async function listRepository(
	ref: RepoRef,
	options: { providers?: Provider[]; signal?: AbortSignal } = {}
): Promise<Listing> {
	const providers = options.providers ?? PROVIDERS;
	let lastError: unknown;

	for (const provider of providers) {
		try {
			return await provider.list(ref, options.signal);
		} catch (error) {
			// A missing repository is the same everywhere; do not ask the others.
			if (error instanceof ProviderError && error.failure === 'not-found') throw error;
			lastError = error;
		}
	}
	throw lastError ?? new Error('No provider could list the repository');
}

/**
 * A repository on a GitHub-shaped forge, as a source.
 *
 * The reference is `HEAD` unless one was named, which is a fact about this
 * forge rather than about sources: both the trees API and raw accept it, so the
 * request that would resolve a default branch by name is never made.
 */
export const githubKind: SourceKind = {
	id: NAME,

	// Any domain for now, which is every host but the local marker:
	// `assertGitHub` inside the listers is what actually refuses the others, and
	// refusing them here is this method's job once a second forge claims some.
	claims: (ref) => ref.host.includes('.'),

	open(ref: RepoRef, options: OpenOptions = {}): Source {
		const branch = options.branch ?? ref.branch ?? 'HEAD';
		const doFetch = options.fetchImpl ?? fetch;

		return {
			id: NAME,
			label: `${ref.owner}/${ref.name}`,
			cacheKey: repoKey(ref),
			// Polite to the CDN while still finishing in well under a second.
			concurrency: 12,
			// At the price of one request, which is what the reader is asking for.
			repeatable: true,

			list: (signal) => listRepository(ref, { providers: options.providers, signal }),

			async read(path, signal) {
				try {
					const response = await doFetch(rawUrl(ref, branch, path), { signal });
					return response.ok ? await response.text() : null;
				} catch {
					return null;
				}
			},

			assetUrl: (path) => rawUrl(ref, branch, path),
			fileUrl: (path) => blobUrl(ref, branch, path)
		};
	}
};
