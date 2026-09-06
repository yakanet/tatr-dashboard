<script lang="ts">
	import { getContext } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import QueryBar from '#lib/components/QueryBar.svelte';
	import RepoStatus from '#lib/components/RepoStatus.svelte';
	import { formatRepoPath } from '#lib/repo/ref.ts';
	import { renderInline } from '#lib/render/markdown.ts';
	import { QUERY, type QueryState } from '#lib/state/query.svelte.ts';
	import { REPOSITORY, type RepositoryState } from '#lib/state/repository.svelte.ts';
	import { byTag } from '#lib/tatr/stats.ts';
	import type { Task } from '#lib/tatr/task.ts';

	let { data } = $props();
	const ref = $derived(data.ref);
	const repo = getContext<RepositoryState>(REPOSITORY);
	// Shared with the dashboard, so a filter set on a chart survives the move here.
	const query = getContext<QueryState>(QUERY);

	const visible = $derived(
		query
			.apply(repo.tasks)
			// Priority descending, as `tatr ls` does by default.
			.toSorted((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
	);
	const pool = $derived(query.showClosed ? repo.tasks.length : repo.open.length);

	// Counted over what the reader is actually looking at, so the tally beside a
	// tag agrees with the list they get by picking it.
	const tagOptions = $derived(
		byTag(query.showClosed ? repo.tasks : repo.open).map(({ tag, count }) => ({
			name: tag,
			description: repo.tags.descriptions.get(tag),
			count
		}))
	);

	function syncUrl() {
		const url = new URL(page.url.href);
		if (query.text.trim()) url.searchParams.set('q', query.text.trim());
		else url.searchParams.delete('q');
		if (query.search.trim()) url.searchParams.set('text', query.search.trim());
		else url.searchParams.delete('text');
		if (query.showClosed) url.searchParams.set('closed', '1');
		else url.searchParams.delete('closed');
		replaceState(url, page.state);
	}

	function toggleTag(tag: string) {
		query.toggle(`:${tag}`);
		syncUrl();
	}

	const describe = (task: Task) => repo.tags.descriptions.get(task.tags[0] ?? '') ?? '';
	const taskHref = (id: string) =>
		resolve('/[...repo]/task/[id]', { repo: formatRepoPath(ref), id });
	const inline = (task: Task) =>
		renderInline(task.title, { ref, branch: repo.branch, taskId: task.id });
</script>

<svelte:head>
	<title>{ref.owner}/{ref.name} — list</title>
</svelte:head>

<QueryBar {query} matched={visible.length} {pool} tags={tagOptions} onchange={syncUrl} />

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
