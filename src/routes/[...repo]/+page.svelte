<script lang="ts">
	import { getContext } from 'svelte';
	import RepoStatus from '#lib/components/RepoStatus.svelte';
	import { renderInline } from '#lib/render/markdown.ts';
	import { REPOSITORY, type RepositoryState } from '#lib/state/repository.svelte.ts';

	let { data } = $props();
	const ref = $derived(data.ref);
	const repo = getContext<RepositoryState>(REPOSITORY);

	const untagged = $derived(repo.tasks.filter((task) => task.tags.length === 0).length);
	const inline = (title: string, taskId: string) =>
		renderInline(title, { ref, branch: repo.branch, taskId });
	const topOpen = $derived(
		repo.open.toSorted((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)).slice(0, 10)
	);
</script>

<svelte:head>
	<title>{ref.owner}/{ref.name} — tatr dashboard</title>
</svelte:head>

<main>
	<RepoStatus {repo} {ref} />

	{#if repo.phase === 'ready'}
		<section class="counts">
			<div><strong>{repo.open.length}</strong><span>open</span></div>
			<div><strong>{repo.closed.length}</strong><span>closed</span></div>
			<div><strong>{repo.tasks.length}</strong><span>total</span></div>
			<div><strong>{untagged}</strong><span>untagged</span></div>
		</section>

		{#if repo.skipped.length > 0}
			<section class="panel">
				<h2>{repo.skipped.length} entries skipped</h2>
				<ul>
					{#each repo.skipped as entry (entry.id)}
						<li class="skipped"><code>{entry.id}</code> {entry.reason}</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="panel">
			<h2>Highest priority, still open</h2>
			<ul>
				{#each topOpen as task (task.id)}
					<li class="task">
						<span class="prio">{task.priority}</span>
						<span class="title">{@html inline(task.title, task.id)}</span>
						{#each task.tags as tag (tag)}<span class="tag">{tag}</span>{/each}
						<code class="id">{task.id}</code>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<style>
	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.counts {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1rem;
	}

	.counts div {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.9rem 1rem;
		display: flex;
		flex-direction: column;
	}

	.counts strong {
		font-family: var(--font-display);
		font-size: 1.9rem;
		font-weight: 700;
		line-height: 1.1;
	}

	.counts span {
		font-size: 0.8rem;
		color: var(--ink-2);
	}

	.panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 1.1rem 1.25rem;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.task {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.4rem 0;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	.task:first-child {
		border-top: none;
	}

	.prio {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent-text);
		width: 2.5rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.title {
		flex-grow: 1;
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
		border: 1px solid var(--border);
		border-radius: 0.2rem;
		padding: 0 0.35rem;
	}

	.id {
		font-size: 0.7rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.skipped {
		font-size: 0.8rem;
		color: var(--ink-2);
		padding: 0.15rem 0;
	}
</style>
