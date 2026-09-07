<script lang="ts">
	// The logo, inline rather than an <img>, so it takes the accent from the
	// theme it is drawn in and needs no request of its own.
	let { size = 22 }: { size?: number } = $props();
</script>

<svg
	viewBox="0 0 32 32"
	width={size}
	height={size}
	role="img"
	aria-label="tatr dashboard"
	fill="none"
	stroke="currentColor"
	stroke-width="3.2"
	stroke-linecap="round"
>
	<path d="M6 8h20" />
	<path d="M6 16h14" />
	<path d="M6 24h6" />
	<circle cx="24" cy="24" r="4" />
</svg>

<style>
	svg {
		display: block;
		flex-shrink: 0;
		color: var(--accent);
	}
</style>
