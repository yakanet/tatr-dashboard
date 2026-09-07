/**
 * What a reading of tasks needs, whatever it is a reading of.
 *
 * The thing worth naming is a *source*, not a forge. A folder on the disk is
 * not a forge and reads tasks perfectly well; a forge is a source that also has
 * URLs, a budget, a branch and an address other people can follow. Naming the
 * interface after the smaller idea is what keeps the local source from being a
 * permanent exception — which is what it was, as a branch in the loader.
 *
 * Contract only: no implementation is imported here, so a source may name this
 * type without anything importing it back.
 */
import type { RepoRef } from '../repo/ref.ts';
import type { Listing, Provider } from './provider.ts';

/**
 * Thrown when a source exists but has nothing to read yet.
 *
 * Which is a state a forge cannot be in and a folder is in after every reload:
 * the browser takes its grant back, so the reference still resolves to a source
 * and the source has no folder behind it. It lives here rather than with the
 * loader so a source can throw it without importing one.
 */
export class NoSourceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'NoSourceError';
	}
}

export interface Source {
	/** `github`, `local`. The UI picks a mark by it; nothing else may. */
	readonly id: string;

	/** What the reading calls itself: `owner/name`, or a folder's name. */
	readonly label: string;

	/*
	 * No `branch` here on purpose. A forge captures one when it is opened, and
	 * uses it to build every URL; a working tree reads its own out of a file,
	 * asynchronously, so it could not answer a synchronous member. Which branch
	 * was read is a fact about the *reading*, and {@link Listing} carries it.
	 */

	/**
	 * Where this reading may be cached, or null when it must not be.
	 *
	 * The shape is the point: "do not cache this" stops being a branch in the
	 * loader and becomes something a source declares. The cache exists to
	 * protect an API budget, and a source that spends none — while pointing at
	 * files someone is editing — answers null and settles the question.
	 */
	readonly cacheKey: string | null;

	/**
	 * How many reads at once this source likes: politeness to a CDN, and
	 * nothing at all to a disk.
	 */
	readonly concurrency: number;

	/**
	 * Whether this reading can be taken again on demand.
	 *
	 * A forge always can, at the price of a request. A folder can only where
	 * the browser handed over a handle to keep — otherwise the reader has to
	 * offer the folder again, and a Refresh button would be a lie.
	 */
	readonly repeatable: boolean;

	/**
	 * Made ready to be read again, before a refresh: walk the folder once more.
	 *
	 * Absent where there is nothing to do — a forge's refresh is the loader
	 * ignoring the cache, not the source doing anything.
	 */
	refresh?(): Promise<void>;

	/** Every file it holds, once. Throws {@link ProviderError} or {@link NoSourceError}. */
	list(signal?: AbortSignal): Promise<Listing>;

	/** One file as text, or null when it cannot be read. */
	read(path: string, signal?: AbortSignal): Promise<string | null>;

	/**
	 * A URL the browser can put in an `<img>` or a link: a raw endpoint, or a
	 * `blob:` for a file already in memory. Null when there is no such file.
	 */
	assetUrl(path: string): string | null;

	/**
	 * The file's own page on the forge, where its history and blame are.
	 *
	 * Optional because its absence is the truth for a folder on the disk: there
	 * is no page anywhere to link to, and a view can ask rather than test what
	 * kind of source it holds.
	 */
	fileUrl?(path: string): string;
}

/** What a caller may say about the reading it wants. */
export interface OpenOptions {
	/** The branch, when the reference did not carry one. */
	branch?: string;
	/** Substitutes for the network, for tests. */
	fetchImpl?: typeof fetch;
	/** Which listers to try, in order, for tests. */
	providers?: Provider[];
}

/**
 * A kind of source: how a reference is recognised, and turned into one.
 *
 * Recognising a reference is not something an instance can do — it is what
 * decides which instance to build — so it sits one storey up. And it cannot be
 * a closed list of hosts: a self-hosted Gitea is on whatever domain its owner
 * chose.
 */
export interface SourceKind {
	readonly id: string;
	claims(ref: RepoRef): boolean;
	open(ref: RepoRef, options?: OpenOptions): Source;
}
