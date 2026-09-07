/**
 * GitHub as a source: the listers it falls through, its URL shapes, and the
 * reference it reads by default.
 *
 * The three listers are all GitHub — its own API, ungh proxying it, jsDelivr
 * serving a cached copy of it — so they are not three sources but one forge's
 * fallback order, which is why they sit in this folder and why the list belongs
 * here rather than inside any one of them. A second forge would start with one
 * lister and no fallback.
 *
 * File contents are read from raw.githubusercontent.com, which is a CDN and
 * sends no rate-limit headers at all: 64 files fetched in parallel came back in
 * a fifth of a second when measured. That split — listing is metered, contents
 * are not — is a fact about this forge, not about sources.
 */
import { repoKey, type RepoRef } from '../../repo/ref.ts';
import { ProviderError, type Listing, type Provider } from '../provider.ts';
import { github } from './api.ts';
import { jsdelivr } from './jsdelivr.ts';
import { ungh } from './ungh.ts';
import type { OpenOptions, Source, SourceKind } from '../source.ts';

const RAW = 'https://raw.githubusercontent.com';
/** The forge's own id, which its primary lister happens to answer to as well. */
const NAME = 'github';

/**
 * Refuses a reference this forge does not serve.
 *
 * Asked once, at the entrance of the fallback chain, rather than by each lister
 * in it: all three read GitHub — its API, a proxy of it, a cache of it — so the
 * host is the forge's business and asking three times said so three times.
 */
function assertHost(ref: RepoRef): void {
	if (ref.host !== 'github.com') {
		throw new ProviderError(
			'unsupported-host',
			NAME,
			`${ref.host} is not supported yet — only github.com`
		);
	}
}

/**
 * Encodes a path one segment at a time, so the slashes between them survive.
 *
 * Branches take the same treatment as paths, and for the same reason: a URL
 * carries `feature/web-ui` as two segments, and `feature%2Fweb-ui` is a branch
 * of that literal name, which no repository has.
 */
const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

/** URL of a file's raw contents. Free of the API budget. */
function rawUrl(ref: RepoRef, branch: string, path: string): string {
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
function blobUrl(ref: RepoRef, branch: string, path: string): string {
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
	assertHost(ref);
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

	// Any domain for now, which is every host but the local marker: `assertHost`
	// is what actually refuses the others, and refusing them here becomes this
	// method's job once a second forge claims some.
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
