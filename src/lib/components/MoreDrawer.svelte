<script lang="ts">
	import type { StatsSummary } from '$lib/game/types';
	import { Drawer } from 'vaul-svelte';
	import { MediaQuery } from 'svelte/reactivity';

	const isDesktop = new MediaQuery('(min-width: 1024px)');
	let {
		open = $bindable(false),
		stats = null,
		onExport = () => {},
		onReset = () => {}
	}: {
		open?: boolean;
		stats?: StatsSummary | null;
		onExport?: () => void | Promise<void>;
		onReset?: () => void | Promise<void>;
	} = $props();
</script>

{#if stats}
	<Drawer.Root bind:open direction={isDesktop.current ? 'right' : 'bottom'}>
		<Drawer.Portal>
			<Drawer.Overlay class="stats-drawer-overlay" onclick={() => (open = false)} />
			<Drawer.Content class="stats-drawer">
				<Drawer.Title class="stats-title">Stats</Drawer.Title>
				<Drawer.Description class="stats-description">
					Total chip investment: {stats.totalInvestment}
				</Drawer.Description>
				<button class="export-button" onclick={() => void onExport()}>Export Game Data</button>
				<button class="reset-button" onclick={() => void onReset()}>Reset All Data</button>
				<div class="stats-grid">
					{#each stats.teamStats as team (team.teamId)}
						<article class="route-card">
							<div class="route-team-meta">
								<span class="team-dot" style={`background:${team.teamColor}`}></span>
								<strong>{team.teamName}</strong>
							</div>
							<p>Invested: {team.totalInvestment}</p>
							<p>Wasted: {team.wastedChips}</p>
							<p>Extra: {team.extraChips}</p>
							<p>Efficient: {team.efficientChips}</p>
						</article>
					{/each}
				</div>
			</Drawer.Content>
		</Drawer.Portal>
	</Drawer.Root>
{/if}

<style>
	:global(.stats-drawer-overlay) {
		position: fixed;
		inset: 0;
		z-index: 16;
		background: rgba(52, 37, 18, 0.3);
	}

	:global(.stats-drawer) {
		position: fixed;
		z-index: 17;
		top: 0.75rem;
		right: 0.75rem;
		bottom: 0.75rem;
		width: min(34rem, calc(100vw - 1.5rem));
		padding: 1rem;
		background: var(--panel);
		backdrop-filter: blur(12px);
		border: 1px solid var(--line);
		border-radius: 24px;
		box-shadow: var(--shadow);
		overflow: clip;
	}

	.route-team-meta {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		flex-wrap: wrap;
	}

	:global(.stats-title) {
		margin: 0;
		font-family: 'Permanent Marker', cursive;
	}

	:global(.stats-description) {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	.route-card {
		padding: 0.8rem;
		margin-top: 0.75rem;
		background: var(--panel-strong);
		border: 1px solid var(--line);
		border-radius: 18px;
	}

	.export-button {
		margin-top: 0.75rem;
		border: 1px solid var(--line);
		background: var(--panel-strong);
		color: inherit;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.reset-button {
		margin-top: 0.5rem;
		border: 1px solid color-mix(in srgb, #a00024 30%, var(--line));
		background: color-mix(in srgb, #a00024 12%, var(--panel-strong));
		color: inherit;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.route-team-meta {
		min-width: 0;
	}

	.stats-grid {
		display: grid;
		gap: 0.65rem;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
	}

	.team-dot {
		width: 0.8rem;
		height: 0.8rem;
		border: 2px solid rgba(0, 0, 0, 0.12);
		border-radius: 999px;
	}

	@media (max-width: 959px) {
		:global(.stats-drawer) {
			top: auto;
			left: 0.75rem;
			right: 0.75rem;
			bottom: 0.75rem;
			width: auto;
			max-height: min(70vh, 38rem);
		}
	}
</style>
