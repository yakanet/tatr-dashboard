/**
 * Turns a reference into the source that serves it.
 *
 * Separate from the contract in `source.ts` so that a source may name the
 * interface without this registry importing it back — the kinds live with their
 * implementations, and only this module knows the whole list.
 */
import type { RepoRef } from '../repo/ref.ts';
import { githubKind } from './github.ts';
import { localKind } from './local.ts';
import type { OpenOptions, Source, SourceKind } from './source.ts';

/**
 * Every kind, by its own id.
 *
 * A record rather than a list, because an id is what a source is looked up by:
 * the UI holds a mark per id, and a reading carries the id it came from. The
 * keys are computed from the kinds so a key cannot disagree with the `id` it
 * stands for.
 *
 * Which is only safe because the claims are disjoint — the local marker is a
 * host with no dot in it, and a forge claims a domain — so there is no
 * precedence to encode and no order to preserve. `claims-nothing-twice` in the
 * spec is what keeps that true.
 */
export const KINDS: Readonly<Record<string, SourceKind>> = {
	[localKind.id]: localKind,
	[githubKind.id]: githubKind
};

export function openSource(ref: RepoRef, options: OpenOptions = {}): Source | null {
	const kind = Object.values(KINDS).find((candidate) => candidate.claims(ref));
	return kind ? kind.open(ref, options) : null;
}
