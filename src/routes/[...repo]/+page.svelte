<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatRepoPath } from '#lib/repo/ref.ts';

	let { data } = $props();
	const ref = $derived(data.ref);
</script>

<svelte:head>
	<title>{ref.owner}/{ref.name} — tatr dashboard</title>
</svelte:head>

<main>
	<p><a href={resolve('/')}>&larr; another repository</a></p>
	<h1>{ref.owner}/{ref.name}</h1>
	<dl>
		<dt>Host</dt>
		<dd>{ref.host}</dd>
		<dt>Branch</dt>
		<dd>{ref.branch ?? 'default'}</dd>
		<dt>Path</dt>
		<dd><code>{formatRepoPath(ref)}</code></dd>
	</dl>
	<p class="todo">Task loading lands in the next work item.</p>
</main>

<style>
	main {
		max-width: 48rem;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}

	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.35rem 1.5rem;
		margin: 1.5rem 0;
	}

	dt {
		color: var(--muted);
	}

	dd {
		margin: 0;
	}

	.todo {
		color: var(--muted);
	}
</style>
