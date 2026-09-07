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
 * Every kind there is. The list is what declares them; {@link KINDS} is how
 * they are looked up.
 *
 * A list can be counted, which a record cannot: written as an object with
 * computed keys, two kinds sharing an id would silently leave one of them out
 * and every test iterating the record would pass over the hole.
 */
const ALL: readonly SourceKind[] = [localKind, githubKind];

/**
 * Every kind, by its own id — because an id is what a source is looked up by:
 * the UI holds a mark per id, and a reading carries the id it came from.
 *
 * Derived rather than written, so a key cannot disagree with the `id` it stands
 * for, and built through a check so a duplicate id is a thrown error at import
 * rather than a source that quietly does not exist.
 *
 * Order is not part of it, which is only true because the claims are disjoint —
 * the local marker is a host with no dot in it, and a forge claims a domain.
 * `claims nothing twice` in the spec is what keeps that true.
 */
export const KINDS: Readonly<Record<string, SourceKind>> = Object.freeze(
	ALL.reduce<Record<string, SourceKind>>((byId, kind) => {
		if (byId[kind.id]) throw new Error(`Two source kinds claim the id ${kind.id}`);
		byId[kind.id] = kind;
		return byId;
	}, {})
);

export function openSource(ref: RepoRef, options: OpenOptions = {}): Source | null {
	const kind = ALL.find((candidate) => candidate.claims(ref));
	return kind ? kind.open(ref, options) : null;
}
