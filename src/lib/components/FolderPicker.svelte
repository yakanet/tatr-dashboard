<script lang="ts">
	// Opens a folder on the reader's machine, by whichever door the browser has.
	//
	// `showDirectoryPicker` gives a handle, which can be walked again — so a
	// refresh becomes a real reread — and exists on Chromium only. The directory
	// input works everywhere and gives a flat list, once. The button is the same
	// button either way: the reader has no interest in which API answered.
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { folderAccess, fromDirectoryHandle, fromFileList, openFolder } from '#lib/sources/local.ts';

	let { label = 'Open a folder…' }: { label?: string } = $props();

	let input = $state<HTMLInputElement | null>(null);
	let error = $state<string | null>(null);

	/** The picker is Chromium only, and must be called from a real click. */
	const hasPicker = folderAccess() === 'picker';

	async function opened() {
		error = null;
		await goto(resolve('/[...repo]', { repo: 'local' }), { invalidateAll: true });
	}

	async function pick() {
		if (!hasPicker) {
			input?.click();
			return;
		}
		try {
			const handle = await window.showDirectoryPicker!({ mode: 'read' });
			openFolder(await fromDirectoryHandle(handle), handle);
			await opened();
		} catch (thrown) {
			// Cancelling the dialog throws, and cancelling is not an error.
			if (thrown instanceof DOMException && thrown.name === 'AbortError') return;
			error = 'That folder could not be read.';
		}
	}

	function chosen(event: Event) {
		const files = (event.currentTarget as HTMLInputElement).files;
		const folder = files && fromFileList(files);
		if (!folder) {
			error = 'Choose a folder, not files inside one.';
			return;
		}
		openFolder(folder);
		opened();
	}
</script>

<button type="button" onclick={pick}>{label}</button>

<input
	bind:this={input}
	type="file"
	webkitdirectory
	multiple
	tabindex="-1"
	aria-hidden="true"
	onchange={chosen}
/>

{#if error}
	<p class="error">{error}</p>
{/if}

<style>
	button {
		padding: 0.55rem 1rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		cursor: pointer;
	}

	button:hover {
		border-color: var(--accent);
	}

	/* Present for the browsers without a picker, and never the thing clicked:
	   a file input cannot be styled, and the button above it can. */
	input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.error {
		margin: 0.5rem 0 0;
		font-size: 0.8rem;
		color: var(--danger);
	}
</style>
