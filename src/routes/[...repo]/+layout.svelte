<script lang="ts">
	import { setContext } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatRepoPath } from '#lib/repo/ref.ts';
	import { RepositoryState, describeAge, REPOSITORY } from '#lib/state/repository.svelte.ts';

	let { data, children } = $props();
	const ref = $derived(data.ref);

	// One state for every view, so navigating between them costs nothing.
	const repo = new RepositoryState();
	setContext(REPOSITORY, repo);

	$effect(() => {
		const current = ref;
		repo.load(current);
		return () => repo.abort();
	});

	const path = $derived(formatRepoPath(ref));
	const views = $derived([
		{ name: 'Overview', href: resolve('/[...repo]', { repo: path }) },
		{ name: 'List', href: resolve('/[...repo]/list', { repo: path }) }
	]);
</script>

<header>
	<a class="brand" href={resolve('/')}>tatr</a>
	<span class="repo">{path}</span>

	<nav>
		{#each views as view (view.href)}
			<a href={view.href} class:current={page.url.pathname === view.href}>{view.name}</a>
		{/each}
	</nav>

	<span class="spacer"></span>

	{#if repo.phase === 'ready'}
		<span class="age">
			{repo.fromCache ? 'cached' : 'read'}
			{describeAge(repo.storedAt)}
			{#if repo.mayBeStale}<span class="stale">· {repo.source} may be behind</span>{/if}
		</span>
		<button onclick={() => repo.load(ref, true)}>Refresh</button>
	{/if}
</header>

{@render children()}

<style>
	header {
		display: flex;
		align-items: center;
		gap: 1rem;
		height: 52px;
		padding: 0 1.5rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	.brand {
		font-weight: 600;
		color: var(--fg);
	}

	.repo {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--ink-2);
	}

	nav {
		display: flex;
		gap: 1.1rem;
	}

	nav a {
		font-size: 0.85rem;
		color: var(--ink-2);
		padding-bottom: 3px;
		border-bottom: 2px solid transparent;
	}

	nav a.current {
		color: var(--fg);
		font-weight: 500;
		border-bottom-color: var(--accent);
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
</style>
