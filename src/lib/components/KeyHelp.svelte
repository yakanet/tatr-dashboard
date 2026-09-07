<script lang="ts">
	import { BINDINGS } from '#lib/keys.ts';

	let { views, onclose }: { views: string[]; onclose: () => void } = $props();

	let panel = $state<HTMLElement | null>(null);

	// Opened from the keyboard, so it has to be reachable from the keyboard: the
	// focus goes in, and Escape takes it back out through the layout's dismiss.
	$effect(() => {
		panel?.focus();
	});
</script>

<!-- A backdrop that closes on click, with the panel stopping the click that
     lands on it. Not a <dialog>: the shortcut layer already owns Escape, and a
     modal dialog would take it back. -->
<div
	class="backdrop"
	role="presentation"
	onclick={onclose}
	onkeydown={(event) => event.key === 'Enter' && onclose()}
>
	<div
		class="panel"
		role="dialog"
		aria-modal="true"
		aria-label="Keyboard shortcuts"
		tabindex="-1"
		bind:this={panel}
		onclick={(event) => event.stopPropagation()}
		onkeydown={(event) => event.stopPropagation()}
	>
		<h2>Keyboard</h2>
		<dl>
			{#each BINDINGS as binding (binding.keys)}
				<div class="row">
					<dt><kbd>{binding.keys}</kbd></dt>
					<dd>{binding.does}</dd>
				</div>
			{/each}
		</dl>

		<p class="views">
			{#each views as view, i (view)}
				<span><kbd>{i + 1}</kbd> {view}</span>
			{/each}
		</p>

		<button type="button" onclick={onclose}>Close</button>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background: rgb(0 0 0 / 0.45);
	}

	.panel {
		width: min(26rem, 100%);
		padding: 1.25rem 1.5rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.6rem;
		box-shadow: 0 16px 48px rgb(0 0 0 / 0.3);
		outline: none;
	}

	h2 {
		margin: 0 0 0.85rem;
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 700;
	}

	dl {
		margin: 0;
		display: grid;
		gap: 0.3rem;
	}

	.row {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		font-size: 0.85rem;
	}

	dt {
		flex-shrink: 0;
		width: 5.5rem;
	}

	dd {
		margin: 0;
		color: var(--ink-2);
	}

	.views {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin: 0.9rem 0 0;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
		font-size: 0.85rem;
		color: var(--ink-2);
	}

	kbd {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--fg);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.2rem;
		padding: 0.05rem 0.3rem;
	}

	button {
		margin-top: 1rem;
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
