<script lang="ts">
	import { getContext } from 'svelte';
	import { resolve } from '$app/paths';
	import RepoStatus from '#lib/components/RepoStatus.svelte';
	import { formatRepoPath } from '#lib/repo/ref.ts';
	import { renderInline } from '#lib/render/markdown.ts';
	import { REPOSITORY, type RepositoryState } from '#lib/state/repository.svelte.ts';
	import { toColumns } from '#lib/tatr/board.ts';
	import type { Task } from '#lib/tatr/task.ts';

	let { data } = $props();
	const ref = $derived(data.ref);
	const repo = getContext<RepositoryState>(REPOSITORY);

	// The whole repository: a board with its Done column filtered away is a list
	// with extra steps.
	const columns = $derived(toColumns(repo.tasks));

	const taskHref = (id: string) =>
		resolve('/[...repo]/task/[id]', { repo: formatRepoPath(ref), id });
	const inline = (task: Task) =>
		renderInline(task.title, { ref, branch: repo.branch, taskId: task.id });
	const describe = (tag: string) => repo.tags.descriptions.get(tag) ?? '';
</script>

<svelte:head>
	<title>{ref.owner}/{ref.name} — board</title>
</svelte:head>

<main>
	<RepoStatus {repo} {ref} />

	{#if repo.phase === 'ready'}
		<div class="board">
			{#each columns as column (column.key)}
				<section class="column">
					<header>
						<h2>{column.name}</h2>
						<span class="tally mono">{column.tasks.length}</span>
						<span class="hint">{column.hint}</span>
					</header>

					{#if column.tasks.length === 0}
						<p class="empty">Nothing here.</p>
					{:else}
						<ul>
							{#each column.tasks as task (task.id)}
								<li>
									<!-- The card is the link, so `j`/`k` and Enter carry the board
									     without a line of its own. -->
									<a href={taskHref(task.id)} data-key-row class:done={column.key === 'done'}>
										<span class="prio mono" class:muted={column.key === 'done'}>
											{task.priority}
										</span>
										<span class="title">{@html inline(task)}</span>
										{#if task.tags.length > 0}
											<span class="tags">
												{#each task.tags as tag (tag)}
													<span class="tag mono" title={describe(tag)}>{tag}</span>
												{/each}
											</span>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 84rem;
		margin: 0 auto;
		padding: 1.75rem 1.5rem 4rem;
	}

	.board {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		align-items: start;
	}

	/* Three columns is the point of the view, so they stack rather than shrink
	   past the width a title needs. */
	@media (max-width: 60rem) {
		.board {
			grid-template-columns: minmax(0, 1fr);
		}

		/* Stacked, the columns are already in one scrolling page: a box inside a
		   box is what makes a phone unusable. */
		.column {
			max-height: none;
		}

		ul {
			overflow-y: visible;
		}
	}

	.column {
		min-width: 0;
		display: flex;
		flex-direction: column;
		/* Done holds 41 cards on tsoding/tatr, so letting the page grow to fit it
		   scrolls the other two headers off the top — and a board whose columns
		   cannot be compared is a list. Each scrolls on its own instead, which is
		   also what `j`/`k` expect: scrollIntoView finds the nearest scroll box. */
		max-height: calc(100vh - 8rem);
	}

	header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0 0.15rem 0.6rem;
		border-bottom: 1px solid var(--border);
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 0.95rem;
		font-weight: 700;
	}

	.tally {
		font-size: 0.8rem;
		color: var(--muted);
	}

	.hint {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--muted);
		text-align: right;
	}

	ul {
		margin: 0;
		padding: 0.6rem 0.15rem 0.15rem;
		list-style: none;
		display: grid;
		gap: 0.5rem;
		overflow-y: auto;
		/* Room for the focus ring, which the overflow would otherwise clip. */
		margin-inline: -0.15rem;
	}

	li a {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.15rem 0.6rem;
		padding: 0.6rem 0.75rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
	}

	li a:hover {
		border-color: var(--accent-line);
	}

	/* Done is context rather than subject, so its cards recede. */
	li a.done {
		background: none;
	}

	.prio {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent-text);
	}

	.prio.muted {
		color: var(--muted);
	}

	.title {
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.tags {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.15rem;
	}

	.tag {
		font-size: 0.68rem;
		color: var(--ink-2);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.2rem;
		padding: 0 0.25rem;
	}

	.empty {
		margin: 0.75rem 0.15rem 0;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.title :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		color: var(--ink-2);
	}
</style>
