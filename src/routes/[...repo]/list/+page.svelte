<script lang="ts">
	import { getContext } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import RepoStatus from '#lib/components/RepoStatus.svelte';
	import { REPOSITORY, type RepositoryState } from '#lib/state/repository.svelte.ts';
	import { resolve } from '$app/paths';
	import { formatRepoPath } from '#lib/repo/ref.ts';
	import { renderInline } from '#lib/render/markdown.ts';
	import { TqlError, compile, formatDiagnostic, parseWithWarnings } from '#lib/tql.ts';
	import type { Task } from '#lib/tatr/task.ts';

	let { data } = $props();
	const ref = $derived(data.ref);
	const repo = getContext<RepositoryState>(REPOSITORY);

	// The query lives in the URL, so a filtered view is a link someone can send.
	let query = $state(page.url.searchParams.get('q') ?? '');
	let showClosed = $state(page.url.searchParams.get('closed') === '1');

	/** Compiled once per query, not once per task. */
	const filter = $derived.by(() => {
		const source = query.trim();
		if (source === '') return { match: () => true, error: null, warnings: [] };
		try {
			const { warnings } = parseWithWarnings(source);
			return { match: compile(source), error: null, warnings };
		} catch (error) {
			return {
				match: () => true,
				error: error instanceof TqlError ? error : null,
				warnings: []
			};
		}
	});

	const visible = $derived.by(() => {
		const pool = showClosed ? repo.tasks : repo.open;
		const matched = filter.error ? pool : pool.filter((task) => filter.match(task));
		// Priority descending, as `tatr ls` does by default.
		return matched.toSorted((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
	});

	function syncUrl() {
		const url = new URL(page.url.href);
		if (query.trim()) url.searchParams.set('q', query.trim());
		else url.searchParams.delete('q');
		if (showClosed) url.searchParams.set('closed', '1');
		else url.searchParams.delete('closed');
		replaceState(url, page.state);
	}

	function toggleTag(tag: string) {
		const token = `:${tag}`;
		query = query.includes(token)
			? query.replace(new RegExp(`\\s*and\\s*${token}|${token}\\s*and\\s*|${token}`), '').trim()
			: query.trim()
				? `${query.trim()} and ${token}`
				: token;
		syncUrl();
	}

	const describe = (task: Task) => repo.tags.descriptions.get(task.tags[0] ?? '') ?? '';
	const taskHref = (id: string) =>
		resolve('/[...repo]/task/[id]', { repo: formatRepoPath(ref), id });
	// Titles in this format routinely carry inline code; show it rendered.
	const inline = (task: Task) =>
		renderInline(task.title, { ref, branch: repo.branch, taskId: task.id });
</script>

<svelte:head>
	<title>{ref.owner}/{ref.name} — list</title>
</svelte:head>

<div class="query" class:invalid={filter.error !== null}>
	<span class="prompt">&gt;</span>
	<input
		bind:value={query}
		oninput={syncUrl}
		placeholder="any"
		spellcheck="false"
		autocapitalize="off"
		autocorrect="off"
		aria-label="Query"
	/>
	{#if repo.phase === 'ready'}
		<span class="count">
			<strong>{visible.length}</strong> matched
			<span class="of">/ {showClosed ? repo.tasks.length : repo.open.length} shown</span>
		</span>
	{/if}
	<label class="closed">
		<input type="checkbox" bind:checked={showClosed} onchange={syncUrl} />
		closed
	</label>
</div>

{#if filter.error}
	<pre class="diagnostic">{formatDiagnostic(query, filter.error)}</pre>
{:else if filter.warnings.length > 0}
	<p class="warning">{filter.warnings[0].message}</p>
{/if}

<main>
	<RepoStatus {repo} {ref} />

	{#if repo.phase === 'ready'}
		{#if visible.length === 0}
			<p class="empty">No task matches this query.</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th class="c-status"><span class="sr">Status</span></th>
						<th class="c-prio">Prio</th>
						<th>Title</th>
						<th class="c-tags">Tags</th>
						<th class="c-id">Id</th>
					</tr>
				</thead>
				<tbody>
					{#each visible as task (task.id)}
						<tr>
							<td class="c-status">
								{#if task.closed}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
										stroke-linecap="round" stroke-linejoin="round" class="icon closed"
										role="img" aria-label={task.status}><path d="M20 6 9 17l-5-5" /></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
										class="icon open" role="img" aria-label={task.status}
										><circle cx="12" cy="12" r="8" /></svg>
								{/if}
							</td>
							<td class="c-prio"><span class="prio">{task.priority}</span></td>
							<td class="title"><a href={taskHref(task.id)}>{@html inline(task)}</a></td>
							<td class="c-tags">
								{#each task.tags as tag (tag)}
									<button class="tag" onclick={() => toggleTag(tag)} title={describe(task)}>
										{tag}
									</button>
								{/each}
							</td>
							<td class="c-id"><code>{task.id}</code></td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	{/if}
</main>

<style>
	.query {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		height: 46px;
		padding: 0 1.5rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	.query.invalid {
		box-shadow: inset 0 -2px 0 var(--danger);
	}

	.prompt {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--accent);
	}

	.query input:not([type]) {
		flex-grow: 1;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: inherit;
		background: none;
		border: none;
		outline: none;
	}

	.count {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--ink-2);
	}

	.of {
		color: var(--muted);
	}

	.closed {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--ink-2);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		border-left: 1px solid var(--border);
		padding-left: 0.75rem;
	}

	.diagnostic {
		margin: 0;
		padding: 0.6rem 1.5rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--danger);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		white-space: pre;
		overflow-x: auto;
	}

	.warning {
		margin: 0;
		padding: 0.5rem 1.5rem;
		font-size: 0.75rem;
		color: var(--warning);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	main {
		max-width: 70rem;
		margin: 0 auto;
		padding: 1.25rem 1.5rem;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
	}

	th {
		text-align: left;
		font-size: 0.7rem;
		font-weight: 400;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	td {
		padding: 0.45rem 0.75rem;
		font-size: 0.85rem;
		border-top: 1px solid var(--border);
		vertical-align: middle;
	}

	tbody tr:first-child td {
		border-top: none;
	}

	.c-status {
		width: 1.75rem;
	}

	.c-prio {
		width: 3rem;
	}

	.c-tags {
		width: 12rem;
	}

	.c-id {
		width: 9.5rem;
	}

	.icon {
		display: block;
		width: 13px;
		height: 13px;
	}

	.icon.open {
		color: var(--accent);
	}

	.icon.closed {
		color: var(--muted);
	}

	.prio {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent-text);
		font-variant-numeric: tabular-nums;
	}

	.title {
		line-height: 1.4;
	}

	.title a {
		color: inherit;
	}

	.title a:hover {
		color: var(--accent-text);
	}

	.title :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		color: var(--ink-2);
	}

	.tag {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-2);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.2rem;
		padding: 0 0.35rem;
		margin-right: 0.25rem;
		cursor: pointer;
	}

	.tag:hover {
		border-color: var(--accent);
		color: var(--accent-text);
	}

	.c-id code {
		font-size: 0.7rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.empty {
		font-size: 0.875rem;
		color: var(--ink-2);
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
