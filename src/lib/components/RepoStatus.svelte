<script lang="ts">
	import { resolve } from '$app/paths';
	import FolderPicker from '#lib/components/FolderPicker.svelte';
	import { describeRef, formatRepoPath, isLocal, type RepoRef } from '#lib/repo/ref.ts';
	import type { RepositoryState } from '#lib/state/repository.svelte.ts';

	let { repo, ref }: { repo: RepositoryState; ref: RepoRef } = $props();

	const percent = $derived(repo.total === 0 ? 0 : Math.round((repo.done / repo.total) * 100));
</script>

{#if repo.phase === 'listing' || repo.phase === 'reading'}
	<section class="panel">
		<p class="step">
			<span class="tick" class:done={repo.phase === 'reading'}></span>
			Listing the repository <span class="hint">one request</span>
		</p>
		<p class="step">
			<span class="tick" class:active={repo.phase === 'reading'}></span>
			Reading task files
			{#if repo.total > 0}<span class="hint">{repo.done} / {repo.total}</span>{/if}
		</p>
		{#if repo.total > 0}
			<div class="bar"><div class="fill" style:width="{percent}%"></div></div>
		{/if}
		<p class="note">Task files are read from a CDN and cost no rate limit.</p>
	</section>
{:else if repo.phase === 'failed' && repo.failure}
	<section class="panel" class:warn={repo.failure.kind === 'rate-limited'}>
		{#if repo.failure.kind === 'rate-limited'}
			<h2>Rate limit reached</h2>
			<p>
				GitHub allows 60 unauthenticated requests per hour per IP address, and this address has used
				all of them. Every fallback was tried too.
			</p>
			<p class="note">
				Only the initial listing costs quota — reading task files never does. A repository loaded
				once stays available without spending any.
			</p>
		{:else if repo.failure.kind === 'not-found'}
			<h2>Not found</h2>
			<p>No repository at <code>{formatRepoPath(ref)}</code>, or it is private.</p>
		{:else if repo.failure.kind === 'no-folder'}
			<h2>No folder open</h2>
			<p>
				A folder is read where it sits, so the browser only grants access while you are here — a
				reload takes it back. Choose it again to carry on.
			</p>
		{:else if repo.failure.kind === 'no-tasks-folder'}
			<h2>No tasks folder</h2>
			<p>
				<code>{describeRef(ref)}</code> was read, but it has no <code>tasks/</code> directory at its
				root.
			</p>
			<p class="note">
				This viewer expects the tatr layout: one folder per task, each holding a
				<code>TASK.md</code>.
			</p>
		{:else if repo.failure.kind === 'unsupported-host'}
			<h2>Not supported yet</h2>
			<p>Only <code>github.com</code> is implemented so far.</p>
		{:else}
			<h2>Could not load</h2>
			<p>{repo.failure.message}</p>
		{/if}
		<div class="actions">
			{#if isLocal(ref)}
				<FolderPicker label="Choose a folder…" />
			{:else}
				<button onclick={() => repo.load(ref, true)}>Try again</button>
			{/if}
			<a href={resolve('/')}>Another repository</a>
		</div>
	</section>
{/if}

<style>
	.panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 1.1rem 1.25rem;
	}

	.panel.warn {
		border-color: var(--warning);
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	p {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		line-height: 1.55;
	}

	.note {
		color: var(--ink-2);
		font-size: 0.8rem;
	}

	.step {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.tick {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		border: 2px solid var(--baseline);
	}

	.tick.done {
		background: var(--good);
		border-color: var(--good);
	}

	.tick.active {
		border-color: var(--accent);
	}

	.hint {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--muted);
	}

	.bar {
		height: 5px;
		border-radius: 3px;
		background: var(--border);
		overflow: hidden;
		margin: 0.5rem 0 0.75rem;
	}

	.fill {
		height: 100%;
		background: var(--accent);
		border-radius: 3px;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.75rem;
	}

	button {
		padding: 0.3rem 0.8rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--on-accent);
		background: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 0.3rem;
		cursor: pointer;
	}
</style>
