<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Mark from '#lib/components/Mark.svelte';
	import { formatRepoPath, parseRepoInput } from '#lib/repo/ref.ts';
	import { toSuggestions, type CachedShape, type Suggestion } from '#lib/repo/recent.ts';
	import { openStore } from '#lib/sources/store.ts';
	import { describeAge } from '#lib/state/repository.svelte.ts';

	let input = $state('');
	let error = $state<string | null>(null);
	let suggestions = $state<Suggestion[]>([]);

	/**
	 * The cache decides what to offer, so this runs in the browser only — the
	 * page is prerendered, and the static HTML ships with nothing in this slot
	 * rather than with a guess that would flash and be replaced.
	 */
	$effect(() => {
		let alive = true;
		openStore()
			.list<CachedShape>()
			.then((rows) => {
				if (alive) suggestions = toSuggestions(rows, formatRepoPath);
			})
			.catch(() => {
				// Storage can be unavailable; the fallback is still worth showing.
				if (alive) suggestions = toSuggestions([], formatRepoPath);
			});
		return () => {
			alive = false;
		};
	});

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

	/** "64 tasks, 23 still open", or what the reference repository is. */
	function describe(one: Suggestion): string {
		if (one.storedAt === null) return 'The reference implementation';
		const tasks = `${one.total} ${one.total === 1 ? 'task' : 'tasks'}`;
		return one.open === 0 ? `${tasks}, all closed` : `${tasks}, ${one.open} still open`;
	}
</script>

<svelte:head>
	<title>tatr dashboard</title>
</svelte:head>

<main>
	<p class="brand"><Mark size={26} /> <span>tatr dashboard</span></p>

	<h1>Read any <code>tasks/</code> folder as a dashboard.</h1>
	<p class="lead">
		Point it at a public repository that follows the
		<a href="https://github.com/tsoding/tatr">tatr</a> layout. Nothing is uploaded — the files are
		read straight from the forge, in your browser, and cached there.
	</p>

	<form onsubmit={open}>
		<span class="field">
			<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				stroke-linecap="round" aria-hidden="true"
				><circle cx="11" cy="11" r="7" /><path d="m20 20-4.3-4.3" /></svg
			>
			<input
				bind:value={input}
				placeholder="owner/name"
				aria-label="Repository"
				autocapitalize="off"
				autocorrect="off"
				autocomplete="off"
				spellcheck="false"
			/>
		</span>
		<button type="submit">Open</button>
	</form>

	<!-- The parser takes all four, and nothing on screen admitted it. -->
	<p class="accepts">
		Accepts <code>owner/name</code>, a full URL, an SSH remote, or <code>owner/name@branch</code>.
	</p>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if suggestions.length > 0}
		<section class="recent">
			<h2>{suggestions[0].storedAt === null ? 'Try it on' : 'Already read'}</h2>
			<ul>
				{#each suggestions as one (one.path)}
					<li>
						<a href={resolve('/[...repo]', { repo: one.path })}>
							<span class="path mono">{one.path}</span>
							<span class="about">
								{describe(one)}
								{#if one.storedAt !== null}
									<span class="age">· read {describeAge(one.storedAt)}</span>
								{/if}
							</span>
							<span class="arrow" aria-hidden="true">→</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<p class="scheme">
		Every repository gets its own address:
		<code>/tsoding/tatr?q=:bug</code>
	</p>
</main>

<style>
	main {
		max-width: 38rem;
		margin: 0 auto;
		padding: clamp(3rem, 12vh, 7rem) 1.5rem 4rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0 0 1.75rem;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 700;
	}

	h1 {
		margin: 0 0 0.9rem;
		font-size: clamp(1.75rem, 5vw, 2.4rem);
		font-weight: 800;
		line-height: 1.1;
	}

	h1 code {
		font-family: var(--font-mono);
		font-size: 0.85em;
		color: var(--accent-text);
	}

	.lead {
		margin: 0 0 1.75rem;
		font-size: 0.95rem;
		line-height: 1.6;
		color: var(--ink-2);
	}

	.lead a {
		color: var(--accent-text);
	}

	form {
		display: flex;
		gap: 0.6rem;
	}

	/* The glyph sits inside the box, so the box has to own the border rather than
	   the input. */
	.field {
		position: relative;
		flex-grow: 1;
		display: flex;
		align-items: center;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
	}

	.field:focus-within {
		border-color: var(--accent);
	}

	.glyph {
		width: 1rem;
		height: 1rem;
		margin: 0 0.5rem 0 0.75rem;
		color: var(--muted);
	}

	.field input {
		flex-grow: 1;
		min-width: 0;
		padding: 0.65rem 0.75rem 0.65rem 0;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		color: inherit;
		background: none;
		border: none;
		outline: none;
	}

	button {
		padding: 0 1.1rem;
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--on-accent);
		background: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 0.4rem;
		cursor: pointer;
	}

	.accepts,
	.scheme {
		margin: 0.6rem 0 0;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.error {
		margin: 0.6rem 0 0;
		font-size: 0.85rem;
		color: var(--danger);
	}

	.recent {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	h2 {
		margin: 0 0 0.7rem;
		font-family: var(--font-sans);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--muted);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.5rem;
	}

	li a {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.15rem 1rem;
		padding: 0.7rem 0.9rem;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
	}

	li a:hover {
		border-color: var(--accent-line);
	}

	.path {
		font-size: 0.9rem;
		color: var(--accent-text);
		overflow-wrap: anywhere;
	}

	.about {
		grid-column: 1;
		font-size: 0.8rem;
		color: var(--ink-2);
	}

	.age {
		color: var(--muted);
	}

	.arrow {
		grid-row: 1 / span 2;
		grid-column: 2;
		color: var(--muted);
	}

	.scheme {
		margin-top: 1.5rem;
	}

	.scheme code,
	.accepts code {
		font-family: var(--font-mono);
		font-size: 0.95em;
		color: var(--ink-2);
	}
</style>
