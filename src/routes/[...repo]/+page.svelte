<script lang="ts">
	import { getContext } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import QueryBar from '#lib/components/QueryBar.svelte';
	import RepoStatus from '#lib/components/RepoStatus.svelte';
	import { formatRepoPath } from '#lib/repo/ref.ts';
	import { renderInline } from '#lib/render/markdown.ts';
	import { QUERY, type QueryState } from '#lib/state/query.svelte.ts';
	import { REPOSITORY, type RepositoryState } from '#lib/state/repository.svelte.ts';
	import { byMonth, byPriority, byTag, counts, summarise, topByPriority } from '#lib/tatr/stats.ts';

	let { data } = $props();
	const ref = $derived(data.ref);
	const repo = getContext<RepositoryState>(REPOSITORY);
	const query = getContext<QueryState>(QUERY);

	// Every figure below is computed from the current query, so clicking a bar
	// changes the whole page rather than one chart.
	const selected = $derived(query.apply(repo.tasks));
	const stats = $derived(counts(selected));
	const summary = $derived(summarise(selected));
	const priorities = $derived(byPriority(selected));
	const tags = $derived(byTag(selected));
	const months = $derived(byMonth(selected));
	const top = $derived(topByPriority(selected.filter((task) => !task.closed), 8));
	const pool = $derived(query.showClosed ? repo.tasks.length : repo.open.length);

	const maxPriority = $derived(Math.max(1, ...priorities.map((bucket) => bucket.count)));
	const maxTag = $derived(Math.max(1, ...tags.map((bucket) => bucket.count)));
	const maxMonth = $derived(Math.max(1, ...months.map((bucket) => bucket.open + bucket.closed)));

	function syncUrl() {
		const url = new URL(page.url.href);
		if (query.text.trim()) url.searchParams.set('q', query.text.trim());
		else url.searchParams.delete('q');
		if (query.showClosed) url.searchParams.set('closed', '1');
		else url.searchParams.delete('closed');
		replaceState(url, page.state);
	}

	function pick(term: string) {
		query.toggle(term);
		syncUrl();
	}

	const inline = (title: string, taskId: string) =>
		renderInline(title, { ref, branch: repo.branch, taskId });
	const taskHref = (id: string) =>
		resolve('/[...repo]/task/[id]', { repo: formatRepoPath(ref), id });
	const monthName = (month: string) => {
		const [year, index] = month.split('-').map(Number);
		const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
			'August', 'September', 'October', 'November', 'December'];
		return `${names[index - 1]} ${year}`;
	};
	const monthLabel = (month: string) =>
		['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][
			Number(month.slice(5, 7)) - 1
		];
</script>

<svelte:head>
	<title>{ref.owner}/{ref.name} — tatr dashboard</title>
</svelte:head>

<QueryBar {query} matched={selected.length} {pool} onchange={syncUrl} />

<main>
	<RepoStatus {repo} {ref} />

	{#if repo.phase === 'ready'}
		<section class="masthead">
			<div class="lead">
				<span class="since mono">
					{months.length > 0 ? `since ${monthName(months[0].month)}` : 'no dates yet'}
				</span>
				<h1>
					<span class="figure">{summary.lead}</span>{#if summary.detail}<span class="detail"
							>, and {summary.detail}.</span
						>{:else}<span class="detail">.</span>{/if}
				</h1>
			</div>
			<div class="figures">
				<div><strong>{stats.closed}</strong><span>closed</span></div>
				<div><strong>{stats.untagged}</strong><span>untagged</span></div>
				<div><strong>{stats.total}</strong><span>selected</span></div>
			</div>
		</section>

		<div class="charts">
			<section class="panel">
				<header>
					<h2>By priority</h2>
					<span class="hint">higher is more urgent</span>
				</header>
				{#if priorities.length === 0}
					<p class="empty">Nothing selected.</p>
				{:else}
					<ul class="bars">
						{#each priorities as bucket (bucket.priority)}
							{@const term = `priority eq ${bucket.priority}`}
							<li>
								<button class="row" class:on={query.has(term)} onclick={() => pick(term)}>
									<span class="label mono">{bucket.priority}</span>
									<span class="track">
										<span class="fill" style:width="{(bucket.count / maxPriority) * 100}%"></span>
									</span>
									<span class="value mono">{bucket.count}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="panel">
				<header>
					<h2>By tag</h2>
					<span class="hint">click to filter</span>
				</header>
				{#if tags.length === 0}
					<p class="empty">Nothing selected carries a tag.</p>
				{:else}
					<ul class="bars">
						{#each tags as bucket (bucket.tag)}
							{@const term = `:${bucket.tag}`}
							<li>
								<button
									class="row"
									class:on={query.has(term)}
									onclick={() => pick(term)}
									title={repo.tags.descriptions.get(bucket.tag) ?? ''}
								>
									<span class="label mono wide">{bucket.tag}</span>
									<span class="track">
										<span class="fill" style:width="{(bucket.count / maxTag) * 100}%"></span>
									</span>
									<span class="value mono">{bucket.count}</span>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		<section class="panel">
			<header>
				<h2>Created per month</h2>
				<span class="legend">
					<span class="key open"></span> still open
					<span class="key closed"></span> since closed
				</span>
				<span class="hint right">dates come from the folder names</span>
			</header>
			{#if months.length === 0}
				<p class="empty">Nothing selected.</p>
			{:else}
				<div class="months">
					{#each months as bucket (bucket.month)}
						{@const total = bucket.open + bucket.closed}
						<div class="month" title="{bucket.month}: {bucket.open} open, {bucket.closed} closed">
							<div class="stack">
								{#if bucket.closed > 0}
									<div class="seg closed" style:height="{(bucket.closed / maxMonth) * 100}%"></div>
								{/if}
								{#if bucket.open > 0}
									<div class="seg open" style:height="{(bucket.open / maxMonth) * 100}%"></div>
								{/if}
							</div>
							<span class="tick mono">{monthLabel(bucket.month)}</span>
							<span class="n mono" class:zero={total === 0}>{total || ''}</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		{#if top.length > 0}
			<section class="panel">
				<header><h2>Highest priority, still open</h2></header>
				<ul class="tasks">
					{#each top as task (task.id)}
						<li>
							<span class="prio mono">{task.priority}</span>
							<a class="title" href={taskHref(task.id)}>{@html inline(task.title, task.id)}</a>
							{#each task.tags as tag (tag)}
								<button class="tag" onclick={() => pick(`:${tag}`)}>{tag}</button>
							{/each}
							<code class="id">{task.id}</code>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</main>

<style>
	main {
		max-width: 64rem;
		margin: 0 auto;
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}

	.masthead {
		display: flex;
		align-items: flex-end;
		gap: 2.5rem;
		padding: 0.5rem 0 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.lead {
		flex-grow: 1;
		min-width: 0;
	}

	.since {
		font-size: 0.7rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}

	h1 {
		margin: 0.5rem 0 0;
		font-family: var(--font-display);
		font-size: 2.4rem;
		line-height: 1.06;
		font-weight: 800;
		letter-spacing: -0.03em;
		text-wrap: pretty;
		max-width: 40ch;
	}

	.figure {
		color: var(--accent-text);
	}

	.detail {
		color: var(--fg);
	}

	.figures {
		display: flex;
		gap: 2rem;
		padding-bottom: 0.35rem;
	}

	.figures div {
		display: flex;
		flex-direction: column;
	}

	.figures strong {
		font-family: var(--font-display);
		font-size: 2rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.03em;
	}

	.figures span {
		font-size: 0.75rem;
		color: var(--ink-2);
	}

	.charts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.panel {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 1rem 1.15rem;
	}

	.panel header {
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}

	h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		font-family: var(--font-display);
	}

	.hint {
		font-size: 0.7rem;
		color: var(--muted);
	}

	.hint.right {
		margin-left: auto;
	}

	.legend {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.7rem;
		color: var(--ink-2);
	}

	.key {
		width: 9px;
		height: 9px;
		border-radius: 2px;
		display: inline-block;
	}

	.key.open,
	.seg.open {
		background: var(--series-open);
	}

	.key.closed,
	.seg.closed {
		background: var(--series-closed);
	}

	.key.closed {
		margin-left: 0.5rem;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.bars {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		width: 100%;
		padding: 0.1rem 0.2rem;
		font: inherit;
		color: inherit;
		background: none;
		border: none;
		border-radius: 0.2rem;
		cursor: pointer;
		text-align: left;
	}

	.row:hover {
		background: var(--bg);
	}

	.row.on {
		background: var(--accent-wash);
	}

	.label {
		width: 2.4rem;
		text-align: right;
		font-size: 0.75rem;
		color: var(--ink-2);
		flex-shrink: 0;
	}

	.label.wide {
		width: 4.5rem;
	}

	.track {
		flex-grow: 1;
		display: block;
	}

	.fill {
		display: block;
		height: 13px;
		background: var(--accent);
		border-radius: 0 4px 4px 0;
	}

	.value {
		width: 2rem;
		font-size: 0.75rem;
		color: var(--ink-2);
	}

	.months {
		display: flex;
		align-items: flex-end;
		gap: 0.35rem;
		height: 132px;
	}

	.month {
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		height: 100%;
	}

	.stack {
		flex-grow: 1;
		width: 100%;
		max-width: 24px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 2px;
		margin: 0 auto;
	}

	.seg {
		border-radius: 3px 3px 0 0;
		min-height: 2px;
	}

	.seg.closed {
		border-radius: 0;
	}

	.tick {
		font-size: 0.65rem;
		color: var(--muted);
	}

	.n {
		font-size: 0.65rem;
		color: var(--ink-2);
		min-height: 0.8rem;
	}

	.n.zero {
		color: transparent;
	}

	.tasks {
		display: flex;
		flex-direction: column;
	}

	.tasks li {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.35rem 0;
		border-top: 1px solid var(--border);
		font-size: 0.85rem;
	}

	.tasks li:first-child {
		border-top: none;
	}

	.prio {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--accent-text);
		width: 2.4rem;
		text-align: right;
	}

	.title {
		flex-grow: 1;
		color: inherit;
	}

	.title:hover {
		color: var(--accent-text);
	}

	.title :global(code) {
		font-family: var(--font-mono);
		font-size: 0.85em;
		color: var(--ink-2);
	}

	.tag {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--ink-2);
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 0.2rem;
		padding: 0 0.35rem;
		cursor: pointer;
	}

	.tag:hover {
		border-color: var(--accent);
		color: var(--accent-text);
	}

	.id {
		font-size: 0.7rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.empty {
		margin: 0;
		font-size: 0.8rem;
		color: var(--ink-2);
	}
</style>
