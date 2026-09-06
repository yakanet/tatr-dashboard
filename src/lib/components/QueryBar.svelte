<script lang="ts">
	import { formatDiagnostic } from '#lib/tql.ts';
	import type { QueryState } from '#lib/state/query.svelte.ts';

	let {
		query,
		matched,
		pool,
		onchange
	}: { query: QueryState; matched: number; pool: number; onchange?: () => void } = $props();
</script>

<div class="bar" class:invalid={query.error !== null}>
	<span class="prompt">&gt;</span>
	<input
		bind:value={query.text}
		oninput={onchange}
		placeholder="any"
		spellcheck="false"
		autocapitalize="off"
		autocorrect="off"
		aria-label="Query"
	/>
	<span class="count"><strong>{matched}</strong> matched <span class="of">/ {pool} shown</span></span>
	<label class="closed">
		<input type="checkbox" bind:checked={query.showClosed} onchange={onchange} />
		closed
	</label>
</div>

{#if query.error}
	<pre class="diagnostic">{formatDiagnostic(query.text, query.error)}</pre>
{:else if query.warnings.length > 0}
	<p class="warning">{query.warnings[0].message}</p>
{/if}

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		height: 46px;
		padding: 0 1.5rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	.bar.invalid {
		box-shadow: inset 0 -2px 0 var(--danger);
	}

	.prompt {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--accent);
	}

	.bar input:not([type]) {
		flex-grow: 1;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: inherit;
		background: none;
		border: none;
		outline: none;
	}

	.count {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--ink-2);
	}

	.of {
		color: var(--muted);
	}

	.closed {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--ink-2);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		border-left: 1px solid var(--border);
		padding-left: 0.75rem;
	}

	.diagnostic {
		margin: 0;
		padding: 0.6rem 1.5rem;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--danger);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		white-space: pre;
		overflow-x: auto;
	}

	.warning {
		margin: 0;
		padding: 0.5rem 1.5rem;
		font-size: 0.75rem;
		color: var(--warning);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}
</style>
