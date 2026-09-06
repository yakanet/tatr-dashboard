<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatRepoPath, parseRepoInput } from '#lib/repo/ref.ts';

	const examples = ['tsoding/tatr'];

	let input = $state('');
	let error = $state<string | null>(null);

	function open(event: SubmitEvent) {
		event.preventDefault();
		const ref = parseRepoInput(input);
		if (!ref) {
			error = 'Expected owner/name, or the URL of a repository.';
			return;
		}
		error = null;
		goto(resolve('/[...repo]', { repo: formatRepoPath(ref) }));
	}
</script>

<svelte:head>
	<title>tatr dashboard</title>
</svelte:head>

<main>
	<h1>tatr dashboard</h1>
	<p class="lead">
		Browse the <code>tasks/</code> folder of any public repository following the
		<a href="https://github.com/tsoding/tatr">tatr</a> layout.
	</p>

	<form onsubmit={open}>
		<input
			bind:value={input}
			placeholder="owner/name"
			aria-label="Repository"
			autocapitalize="off"
			autocorrect="off"
			spellcheck="false"
		/>
		<button type="submit">Open</button>
	</form>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<p class="examples">
		Try
		{#each examples as example (example)}
			<a href={resolve('/[...repo]', { repo: example })}><code>{example}</code></a>
		{/each}
	</p>
</main>

<style>
	main {
		max-width: 34rem;
		margin: 0 auto;
		padding: 4rem 1.5rem;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: 1.75rem;
	}

	.lead {
		margin: 0 0 2rem;
		color: var(--muted);
	}

	form {
		display: flex;
		gap: 0.5rem;
	}

	input {
		flex: 1;
		min-width: 0;
		padding: 0.6rem 0.75rem;
		font: inherit;
		color: inherit;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
	}

	button {
		padding: 0.6rem 1.1rem;
		font: inherit;
		font-weight: 500;
		color: var(--on-accent);
		background: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 0.375rem;
		cursor: pointer;
	}

	.error {
		color: var(--danger);
	}

	.examples {
		margin-top: 2rem;
		color: var(--muted);
	}
</style>
