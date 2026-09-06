<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatRepoPath } from '#lib/repo/ref.ts';
	import { RepositoryState, describeAge } from '#lib/state/repository.svelte.ts';

	let { data } = $props();
	const ref = $derived(data.ref);

	const repo = new RepositoryState();

	// Reload whenever the address changes, so back and forward behave.
	$effect(() => {
		const current = ref;
		repo.load(current);
		return () => repo.abort();
	});

	const percent = $derived(repo.total === 0 ? 0 : Math.round((repo.done / repo.total) * 100));
	const untagged = $derived(repo.tasks.filter((task) => task.tags.length === 0).length);
</script>

<svelte:head>
	<title>{ref.owner}/{ref.name} — tatr dashboard</title>
</svelte:head>

<header>
	<a class="back" href={resolve('/')}>tatr</a>
	<span class="repo">{formatRepoPath(ref)}</span>
	<span class="spacer"></span>

	{#if repo.phase === 'ready'}
		<span class="age">
			{repo.fromCache ? `cached ${describeAge(repo.storedAt)}` : `read ${describeAge(repo.storedAt)}`}
			{#if repo.mayBeStale}<span class="stale">· {repo.source} may be behind</span>{/if}
		</span>
		<button onclick={() => repo.load(ref, true)}>Refresh</button>
	{/if}
</header>

<main>
	{#if repo.phase === 'listing' || repo.phase === 'reading'}
		<section class="panel loading">
			<p class="step">
				<span class="tick" class:done={repo.phase === 'reading'}></span>
				Listing the repository
				<span class="hint">one request</span>
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
		<section class="panel failure" class:warn={repo.failure.kind === 'rate-limited'}>
			{#if repo.failure.kind === 'rate-limited'}
				<h2>Rate limit reached</h2>
				<p>
					GitHub allows 60 unauthenticated requests per hour per IP address, and this address has
					used all of them. Every fallback was tried too.
				</p>
				<p class="note">
					Only the initial listing costs quota — reading task files never does. A repository loaded
					once stays available without spending any.
				</p>
			{:else if repo.failure.kind === 'not-found'}
				<h2>Not found</h2>
				<p>No repository at <code>{formatRepoPath(ref)}</code>, or it is private.</p>
			{:else if repo.failure.kind === 'no-tasks-folder'}
				<h2>No tasks folder</h2>
				<p>
					<code>{ref.owner}/{ref.name}</code> was read, but it has no <code>tasks/</code> directory
					at its root.
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
				<button onclick={() => repo.load(ref, true)}>Try again</button>
				<a href={resolve('/')}>Another repository</a>
			</div>
		</section>
	{:else if repo.phase === 'ready'}
		<section class="counts">
			<div><strong>{repo.open.length}</strong><span>open</span></div>
			<div><strong>{repo.closed.length}</strong><span>closed</span></div>
			<div><strong>{repo.tasks.length}</strong><span>total</span></div>
			<div><strong>{untagged}</strong><span>untagged</span></div>
		</section>

		{#if repo.skipped.length > 0}
			<section class="panel">
				<h2>{repo.skipped.length} entries skipped</h2>
				<ul class="skipped">
					{#each repo.skipped as entry (entry.id)}
						<li><code>{entry.id}</code> {entry.reason}</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="panel">
			<h2>Highest priority, still open</h2>
			<ul class="tasks">
				{#each repo.open.slice().sort((a, b) => b.priority - a.priority).slice(0, 10) as task (task.id)}
					<li>
						<span class="prio">{task.priority}</span>
						<span class="title">{task.title}</span>
						{#each task.tags as tag (tag)}<span class="tag">{tag}</span>{/each}
						<code class="id">{task.id}</code>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		height: 52px;
		padding: 0 1.5rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	.back {
		font-weight: 600;
		color: var(--fg);
	}

	.repo {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--ink-2);
	}

	.spacer {
		flex-grow: 1;
	}

	.age {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.stale {
		color: var(--warning);
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

	main {
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 1.1rem 1.25rem;
	}

	.panel h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	.panel p {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		line-height: 1.55;
	}

	.failure.warn {
		border-color: var(--warning);
	}

	.note {
		color: var(--ink-2);
		font-size: 0.8rem !important;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 0.75rem;
	}

	.step {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.875rem;
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

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tasks li {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.4rem 0;
		border-top: 1px solid var(--border);
		font-size: 0.875rem;
	}

	.tasks li:first-child {
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

	.skipped li {
		font-size: 0.8rem;
		color: var(--ink-2);
		padding: 0.15rem 0;
	}
</style>
