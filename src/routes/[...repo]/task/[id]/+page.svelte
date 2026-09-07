<script lang="ts">
	import { getContext } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatRepoPath } from '#lib/repo/ref.ts';
	import { renderInline, renderMarkdown, splitJournal } from '#lib/render/markdown.ts';
	import { loadTaskDescription } from '#lib/sources/load.ts';
	import { REPOSITORY, type RepositoryState } from '#lib/state/repository.svelte.ts';

	let { data } = $props();
	const ref = $derived(data.ref);
	const repo = getContext<RepositoryState>(REPOSITORY);

	const id = $derived(page.params.id ?? '');
	const task = $derived(repo.tasks.find((candidate) => candidate.id === id));

	// Bodies are not cached, so a task opened from a cached repository fetches
	// its own prose. It costs no quota and takes about 30 ms.
	let body = $state<string | null>(null);
	let loadingBody = $state(false);

	$effect(() => {
		const current = task;
		if (!current) return;
		if (current.description !== undefined) {
			body = current.description;
			return;
		}
		loadingBody = true;
		let cancelled = false;
		loadTaskDescription(ref, repo.branch, current.id).then((text) => {
			if (cancelled) return;
			body = text ?? '';
			loadingBody = false;
		});
		return () => {
			cancelled = true;
		};
	});

	const entries = $derived(body === null ? [] : splitJournal(body));
	const renderOptions = $derived({ ref, branch: repo.branch, taskId: id });
	const render = (source: string) => renderMarkdown(source, renderOptions);
	const inline = (source: string) => renderInline(source, renderOptions);

	/** Tasks this one points at, and tasks pointing back at it. */
	const outgoing = $derived(
		(task?.references ?? [])
			.map((other) => repo.tasks.find((candidate) => candidate.id === other))
			.filter((other) => other !== undefined)
	);
	const incoming = $derived(repo.tasks.filter((other) => other.references.includes(id)));
	const mutual = $derived(new Set(incoming.map((other) => other.id)));

	const listHref = $derived(resolve('/[...repo]/list', { repo: formatRepoPath(ref) }));
	const taskHref = (other: string) =>
		resolve('/[...repo]/task/[id]', { repo: formatRepoPath(ref), id: other });
</script>

<svelte:head>
	<title>{task?.title ?? id} — {ref.owner}/{ref.name}</title>
</svelte:head>

<main>
	{#if repo.phase !== 'ready'}
		<p class="muted">Loading…</p>
	{:else if !task}
		<section class="panel">
			<h2>No such task</h2>
			<p>This repository has no task <code>{id}</code>.</p>
			<p><a href={listHref}>Back to the list</a></p>
		</section>
	{:else}
		<article class="panel">
			<div class="meta">
				<span class="status" class:closed={task.closed}>{task.status}</span>
				<span class="prio">priority {task.priority}</span>
				<span class="muted">·</span>
				<span class="muted">
					created {task.created.toISOString().slice(0, 10)}
					{task.created.toISOString().slice(11, 16)} UTC
				</span>
			</div>

			<h1>{@html inline(task.title)}</h1>

			{#if task.malformed}
				<p class="warning">
					This file does not start with <code>#</code>, so the reference parser abandons its
					properties entirely. It is shown as it was read.
				</p>
			{/if}

			{#if loadingBody}
				<p class="muted">Reading the body…</p>
			{:else if entries.length === 0}
				<p class="muted">No description.</p>
			{:else}
				<div class="journal">
					{#each entries as entry, index (index)}
						<div
							class="entry"
							class:first={index === 0}
							class:last={index === entries.length - 1}
						>
							<span class="bullet"></span>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<div class="prose">{@html render(entry)}</div>
						</div>
					{/each}
				</div>
			{/if}
		</article>

		<aside>
			<section class="panel">
				<h2>Properties</h2>
				<dl>
					{#each task.properties as [key, value] (key)}
						<dt>{key}</dt>
						<dd>{value || '—'}</dd>
					{/each}
				</dl>
				<p class="note">Any property key is shown, not just these.</p>
			</section>

			{#if outgoing.length > 0 || incoming.length > 0}
				<section class="panel">
					<h2>References</h2>
					<ul>
						{#each outgoing as other (other.id)}
							<li>
								<a href={taskHref(other.id)}>
									<code>{other.id}</code>
									<span>{@html inline(other.title)}</span>
								</a>
								<span class="direction">{mutual.has(other.id) ? 'mutual' : 'refers to'}</span>
							</li>
						{/each}
						{#each incoming.filter((other) => !task.references.includes(other.id)) as other (other.id)}
							<li>
								<a href={taskHref(other.id)}>
									<code>{other.id}</code>
									<span>{@html inline(other.title)}</span>
								</a>
								<span class="direction">refers here</span>
							</li>
						{/each}
					</ul>
					<p class="note">Found by scanning task text for ids.</p>
				</section>
			{/if}

			<p><a href={listHref}>← Back to the list</a></p>
		</aside>
	{/if}
</main>

<style>
	main {
		max-width: 70rem;
		margin: 0 auto;
		padding: 1.5rem;
		display: grid;
		grid-template-columns: 1fr 18rem;
		gap: 1.25rem;
		align-items: start;
	}

	main > p,
	main > section {
		grid-column: 1 / -1;
	}

	.panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 1.25rem 1.5rem;
	}

	aside {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.status {
		display: inline-flex;
		align-items: center;
		font-weight: 500;
		letter-spacing: 0.04em;
		color: var(--accent-text);
		background: var(--accent-wash);
		border: 1px solid var(--accent-line);
		border-radius: 0.2rem;
		padding: 0.1rem 0.45rem;
	}

	.status.closed {
		color: var(--ink-2);
		background: var(--bg);
		border-color: var(--border);
	}

	.prio {
		font-family: var(--font-mono);
		color: var(--ink-2);
	}

	.muted {
		color: var(--muted);
	}

	h1 :global(code) {
		font-family: var(--font-mono);
		font-size: 0.86em;
	}

	h1 {
		margin: 0 0 1.25rem;
		font-size: 1.55rem;
		line-height: 1.28;
		font-weight: 700;
		text-wrap: pretty;
	}

	h2 {
		margin: 0 0 0.6rem;
		font-size: 0.7rem;
		font-weight: 400;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.journal {
		display: flex;
		flex-direction: column;
	}

	/*
	 * A body is a journal: the original description, then whatever was appended
	 * after it, split on `---`. The bullets mark where each entry starts and the
	 * rule joins them, so the shape says "added over time" on its own.
	 *
	 * They are deliberately all the same colour. Highlighting the last one coded
	 * nothing the reader could not already see — it is the one at the bottom —
	 * and a colour that carries no meaning still asks to be decoded. Dating them
	 * instead is not an option here: not one of the 97 journal entries in
	 * tsoding/tatr carries a date. The `## NOTE(<huid>)` headings that do are a
	 * different convention, written inside a body rather than between entries,
	 * and markdown already renders them.
	 */
	.entry {
		display: flex;
		gap: 1rem;
		position: relative;
		/* Where a bullet's centre sits: its top margin plus half its height. */
		--bullet-mid: calc(0.65rem + 3.5px);
	}

	/* The rule runs the height of every entry, so it reaches the end of the text
	   rather than stopping at the last bullet — which read as unfinished whenever
	   the last entry was long. It starts at the first bullet's centre, since
	   nothing precedes it there. */
	.entry::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 3px;
		width: 1px;
		/* The bullets' own colour: `--border` disappears against the card in dark
		   mode, being a step away from the surface it sits on. At 1px against a
		   7px dot it still reads as the lighter of the two. */
		background: var(--baseline);
	}

	.entry.first::before {
		top: var(--bullet-mid);
	}

	/* A single entry is not a sequence, so it gets no rule at all — a line down
	   the side of one block reads as a quotation, not as a journal. */
	.entry.first.last::before {
		display: none;
	}

	.bullet {
		flex-shrink: 0;
		width: 7px;
		height: 7px;
		margin-top: 0.65rem;
		border-radius: 50%;
		background: var(--baseline);
		/* Above the rule, and it paints over the piece running behind it. */
		position: relative;
		z-index: 1;
		box-shadow: 0 0 0 3px var(--surface);
	}

	.prose {
		flex-grow: 1;
		font-size: 0.9rem;
		line-height: 1.62;
		min-width: 0;
	}

	.prose :global(p) {
		margin: 0 0 0.9rem;
		text-wrap: pretty;
	}

	.prose :global(pre) {
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.25rem;
		padding: 0.6rem 0.8rem;
		overflow-x: auto;
		font-size: 0.8rem;
	}

	.prose :global(img) {
		max-width: 100%;
		border: 1px solid var(--border);
		border-radius: 0.25rem;
	}

	.prose :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 1rem;
		margin: 0 0 0.75rem;
		font-size: 0.8rem;
	}

	dt {
		font-family: var(--font-mono);
		color: var(--muted);
	}

	dd {
		margin: 0;
		font-family: var(--font-mono);
	}

	ul {
		list-style: none;
		margin: 0 0 0.6rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	li a {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	li code {
		font-size: 0.7rem;
	}

	li span {
		font-size: 0.8rem;
		color: var(--ink-2);
		line-height: 1.35;
	}

	.direction {
		font-size: 0.7rem !important;
		color: var(--muted) !important;
	}

	.note {
		margin: 0;
		font-size: 0.7rem;
		color: var(--muted);
		line-height: 1.45;
	}

	.warning {
		font-size: 0.8rem;
		color: var(--warning);
	}
</style>
