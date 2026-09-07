<script lang="ts">
	import { setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import KeyHelp from '#lib/components/KeyHelp.svelte';
	import Mark from '#lib/components/Mark.svelte';
	import Shortcuts from '#lib/components/Shortcuts.svelte';
	import FolderPicker from '#lib/components/FolderPicker.svelte';
	import { formatRepoPath, isLocal } from '#lib/repo/ref.ts';
	import { openSource } from '#lib/sources/open.ts';
	import { RepositoryState, describeAge, REPOSITORY } from '#lib/state/repository.svelte.ts';
	import { QUERY, QueryState } from '#lib/state/query.svelte.ts';

	let { data, children } = $props();
	const ref = $derived(data.ref);

	// One state for every view, so navigating between them costs nothing.
	const repo = new RepositoryState();
	setContext(REPOSITORY, repo);

	// One query too: the charts filter the list and vice versa.
	const query = new QueryState();
	query.text = page.url.searchParams.get('q') ?? '';
	query.showClosed = page.url.searchParams.get('closed') === '1';
	setContext(QUERY, query);

	$effect(() => {
		const current = ref;
		repo.load(current);
		return () => repo.abort();
	});

	const path = $derived(formatRepoPath(ref));
	/**
	 * What the header calls this repository: the URL form for a forge, branch and
	 * all, and for a folder the name the reading found — no URL carries it.
	 */
	const label = $derived(isLocal(ref) ? repo.name : path);

	/**
	 * Whether Refresh means anything here, which only the source knows.
	 *
	 * Recomputed when the reference changes, and a folder being opened is not a
	 * change of reference — it is module state, which nothing here observes. It
	 * holds because every way of opening a folder ends in a navigation that
	 * renews `ref`; if one ever does not, this is where it will read `Refresh`
	 * over a folder that cannot be refreshed.
	 */
	const repeatable = $derived(openSource(ref)?.repeatable ?? false);

	/** The query travels with the link, so a filtered view stays shareable. */
	const search = $derived.by(() => {
		const params = new URLSearchParams();
		if (query.text.trim()) params.set('q', query.text.trim());
		if (query.showClosed) params.set('closed', '1');
		const rendered = params.toString();
		return rendered ? `?${rendered}` : '';
	});

	let helping = $state(false);

	const views = $derived([
		{ name: 'Overview', base: resolve('/[...repo]', { repo: path }) },
		{ name: 'List', base: resolve('/[...repo]/list', { repo: path }) },
		{ name: 'Board', base: resolve('/[...repo]/board', { repo: path }) },
		{ name: 'References', base: resolve('/[...repo]/graph', { repo: path }) }
	]);

	/** `1`-`9` counts positions in the nav, so an absent view simply does nothing. */
	function switchTo(index: number) {
		const view = views[index];
		if (view) goto(view.base + search);
	}

	/** Escape closes what is open, in the order a reader would expect. */
	function dismiss() {
		if (helping) helping = false;
	}
</script>

<Shortcuts
	onview={switchTo}
	onhelp={() => (helping = !helping)}
	ondismiss={dismiss}
	modal={helping}
/>

{#if helping}
	<KeyHelp views={views.map((view) => view.name)} onclose={() => (helping = false)} />
{/if}

<header>
	<!-- Brand, path and views are set at three sizes, so they are grouped and
	     aligned on their shared baseline: centring them instead lines up the
	     middle of each box, which leaves the smaller type sitting low. -->
	<div class="identity">
		<a class="brand" href={resolve('/')}><Mark size={18} /> tatr</a>
		<span class="repo">{label}</span>

		<nav>
			{#each views as view (view.base)}
				<a href={view.base + search} class:current={page.url.pathname === view.base}>{view.name}</a>
			{/each}
		</nav>
	</div>

	<span class="spacer"></span>

	{#if repo.phase === 'ready'}
		<span class="age">
			{repo.fromCache ? 'cached' : 'read'}
			{describeAge(repo.storedAt)}
			{#if repo.mayBeStale}<span class="stale">· {repo.source} may be behind</span>{/if}
			<!-- The reading stayed; only renewing it failed, which is worth one
			     clause rather than a panel over tasks that are still true. -->
			{#if repo.refreshFailure}
				<span class="stale">· not refreshed: {repo.refreshFailure.message}</span>
			{/if}
		</span>
		{#if repeatable}
			<button onclick={() => repo.load(ref, true)}>Refresh</button>
		{:else}
			<!-- A reading that cannot be taken again: a directory input hands over
			     files and no way back to the folder they came from, so refreshing
			     means asking for it again rather than pretending. -->
			<FolderPicker label="Reopen…" />
		{/if}
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

	.identity {
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}

	.brand {
		display: flex;
		/* The word, not the mark, is what the row aligns on: see Mark's own note. */
		align-items: baseline;
		gap: 0.4rem;
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
