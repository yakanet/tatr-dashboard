/**
 * jsDelivr as the last-resort listing provider.
 *
 * No budget and permissive CORS, but it serves a cached view of the repository:
 * when measured it reported 63 of 64 tasks, missing the most recent one. Its
 * listings are therefore flagged as possibly stale so the UI can say so.
 */
import {type Provider, ProviderError} from '../provider.ts';

const API = 'https://data.jsdelivr.com/v1/packages/gh';
const NAME = 'jsdelivr';

interface JsDelivrResponse {
	files?: { name: string; size?: number }[];
}

export const jsdelivr: Provider = {
	name: NAME,

	async list(ref, signal) {
		const branch = ref.branch ?? 'HEAD';
		const url = `${API}/${ref.owner}/${ref.name}@${encodeURIComponent(branch)}?structure=flat`;

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
			throw new ProviderError('network', NAME, `jsDelivr answered ${response.status}`);
		}

		const body = (await response.json()) as JsDelivrResponse;
		if (!Array.isArray(body.files)) {
			throw new ProviderError('malformed', NAME, 'No files in the response');
		}

		return {
			// jsDelivr paths are absolute; the rest of the app expects repo-relative ones.
			entries: body.files.map((file) => {
				const path = file.name.replace(/^\//, '');
				return file.size === undefined ? { path } : { path, size: file.size };
			}),
			source: NAME,
			mayBeStale: true,
			branch
		};
	}
};
