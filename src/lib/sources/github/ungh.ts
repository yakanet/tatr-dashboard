/**
 * ungh.cc as a fallback listing provider.
 *
 * It proxies the GitHub API with its own credentials, so it imposes no
 * per-visitor budget, sends `access-control-allow-origin: *`, and was measured
 * to return the repository in full (64 of 64 tasks) rather than a late copy.
 *
 * It is a free third-party service with no uptime guarantee, which is why it
 * sits behind GitHub rather than in front of it: the normal path should not
 * depend on someone else's goodwill.
 */
import {type Provider, ProviderError} from '../provider.ts';

const API = 'https://ungh.cc';
const NAME = 'ungh';

interface UnghResponse {
	files?: { path: string; size?: number }[];
}

export const ungh: Provider = {
	name: NAME,

	async list(ref, signal) {
		const branch = ref.branch ?? 'HEAD';
		const url = `${API}/repos/${ref.owner}/${ref.name}/files/${encodeURIComponent(branch)}`;

		let response: Response;
		try {
			response = await fetch(url, { signal });
		} catch {
			throw new ProviderError('network', NAME, `Could not reach ${url}`);
		}
		if (response.status === 404) {
			throw new ProviderError('not-found', NAME, 'Repository or branch not found');
		}
		if (!response.ok) {
			throw new ProviderError('network', NAME, `ungh answered ${response.status}`);
		}

		const body = (await response.json()) as UnghResponse;
		if (!Array.isArray(body.files)) {
			throw new ProviderError('malformed', NAME, 'No files in the response');
		}

		return {
			entries: body.files.map((file) =>
				file.size === undefined ? { path: file.path } : { path: file.path, size: file.size }
			),
			source: NAME,
			mayBeStale: false,
			// ungh resolves HEAD itself; we only know the branch when it was given.
			branch: ref.branch ?? 'HEAD'
		};
	}
};
