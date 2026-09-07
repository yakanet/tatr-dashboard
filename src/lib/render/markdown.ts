/**
 * Renders a task's markdown for display.
 *
 * The source is a `TASK.md` from an arbitrary third-party repository, so it is
 * hostile input. Rather than rendering raw HTML and scrubbing it afterwards,
 * this never lets HTML in at all: markdown-it runs with `html: false`, so any
 * markup in the source is escaped into text, and its link validator refuses
 * `javascript:` and `data:` URLs outright. There is nothing left to sanitise,
 * which is a stronger position than sanitising well.
 *
 * Relative links still have to be rewritten. A task refers to its attachments
 * as `./screenshot.png`, which means nothing once the markdown leaves the
 * repository, so they are resolved against the task's own folder on the CDN.
 */
import MarkdownIt from 'markdown-it';
import type { RepoRef } from '../repo/ref.ts';
import { isLocal } from '../repo/ref.ts';
import { assetUrl } from '../sources/local.ts';
import { rawUrl } from '../sources/github.ts';

export interface RenderOptions {
	ref: RepoRef;
	branch: string;
	/** The task whose folder relative links resolve against. */
	taskId: string;
}

/** Only the repository's own CDN may load an image, so a task cannot beacon readers. */
const IMAGE_HOST = 'https://raw.githubusercontent.com/';

/** True for a link that points inside the repository rather than out of it. */
function isRelative(url: string): boolean {
	return !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('//') && !url.startsWith('#');
}

/**
 * Resolves a repository-relative path against a task folder, refusing anything
 * that climbs out of it.
 */
export function resolveAttachment(options: RenderOptions, url: string): string | null {
	const segments = `tasks/${options.taskId}/${url}`.split('/');
	const stack: string[] = [];

	for (const segment of segments) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') {
			if (stack.length === 0) return null;
			stack.pop();
			continue;
		}
		stack.push(segment);
	}

	const path = stack.join('/');
	// Anything outside tasks/ is not an attachment of this repository's tasks.
	if (!path.startsWith('tasks/')) return null;
	// A folder on this machine has no raw endpoint. A `blob:` made from the file
	// the reader gave access to is the same thing by other means, and it is why
	// this returns a URL rather than building one: only the source knows how.
	if (isLocal(options.ref)) return assetUrl(path);
	return rawUrl(options.ref, options.branch, path);
}

function createRenderer(options: RenderOptions): InstanceType<typeof MarkdownIt> {
	const md = new MarkdownIt({
		html: false, // escape any markup in the source
		linkify: false, // only explicit links become links
		breaks: false,
		typographer: false
	});

	const defaultLinkOpen =
		md.renderer.rules.link_open ??
		((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));

	md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
		const token = tokens[idx];
		const href = String(token.attrGet('href') ?? '');

		if (isRelative(href)) {
			const resolved = resolveAttachment(options, href);
			if (resolved) token.attrSet('href', resolved);
			else token.attrs = (token.attrs ?? []).filter(([name]) => name !== 'href');
		} else {
			// External destinations open away from the page and cannot reach back.
			token.attrSet('rel', 'noopener noreferrer');
			token.attrSet('target', '_blank');
		}
		return defaultLinkOpen(tokens, idx, opts, env, self);
	};

	md.renderer.rules.image = (tokens, idx, opts, env, self) => {
		const token = tokens[idx];
		const src = String(token.attrGet('src') ?? '');

		if (isRelative(src)) {
			const resolved = resolveAttachment(options, src);
			if (resolved) token.attrSet('src', resolved);
			else token.attrs = (token.attrs ?? []).filter(([name]) => name !== 'src');
		} else if (!src.startsWith(IMAGE_HOST)) {
			token.attrs = (token.attrs ?? []).filter(([name]) => name !== 'src');
		}
		return self.renderToken(tokens, idx, opts);
	};

	return md;
}

/** Renders markdown to HTML, with attachment links resolved. */
export function renderMarkdown(source: string, options: RenderOptions): string {
	return createRenderer(options).render(source);
}

/**
 * Renders a single line without wrapping it in a paragraph — for titles, which
 * routinely carry inline code in this format (`` `tatr ls` relative paths are
 * broken ``). Showing the backticks raw would be showing the file, not the task.
 */
export function renderInline(source: string, options: RenderOptions): string {
	return createRenderer(options).renderInline(source);
}

/**
 * Splits a description on its `---` separators. Task bodies are written as an
 * append-only journal, so each block is one entry, oldest first.
 */
export function splitJournal(description: string): string[] {
	return description
		.split(/^\s*---\s*$/m)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}
