<script lang="ts">
	import { formatTimestamp, getChallengeValue } from '$lib/utils';
	import ActionDrawer from './ActionDrawer.svelte';
	import type { ActionResult, SelectedStationView } from '$lib/game/types';
	import { Drawer } from 'vaul-svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import {
		completeChallenge,
		debtStation,
		depositStation,
		failChallenge
	} from '$lib/game/game.svelte.js';

	let {
		stationId = $bindable(null),
		station = null,
		selectedTeamId = null,
		gameStarted = true,
		canDebt,
		openShareMenu
	}: {
		stationId: string | null;
		station: SelectedStationView | null;
		selectedTeamId?: string | null;
		gameStarted?: boolean;
		canDebt: boolean;
		openShareMenu: (r: ActionResult | null) => void;
	} = $props();

	const isDesktop = new MediaQuery('(min-width: 1024px)');
	let showDeposit = $state(false);
	let showComplete = $state(false);
	let showFail = $state(false);
	let showDebt = $state(false);

	function openGoogleMaps(url: string) {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

{#key station?.id ?? 'none'}
	<Drawer.Root
		direction={isDesktop.current ? 'right' : 'bottom'}
		open={Boolean(station)}
		onOpenChange={(open) => {
			if (!open) stationId = null;
			showDeposit = false;
			showComplete = false;
			showFail = false;
			showDebt = false;
		}}
	>
		{#if station}
			<Drawer.Portal>
				<Drawer.Overlay class="overlay" onclick={() => (stationId = null)} />
				<Drawer.Content class="panel sheet">
					<p class="id">{station.id}</p>
					<Drawer.Title class="title">{station.name}</Drawer.Title>

					<div class="actions">
						<button
							class="primary-button"
							type="button"
							data-vaul-no-drag
							disabled={!selectedTeamId || !gameStarted}
							onclick={() => (showDeposit = true)}
						>
							Deposit
						</button>

						{#if canDebt}
							<button
								class="ghost-button"
								type="button"
								data-vaul-no-drag
								disabled={!selectedTeamId || !gameStarted}
								onclick={() => (showDebt = true)}
							>
								Debt
							</button>
						{/if}
					</div>

					{#if station.challenge.isActive}
						<div class="card">
							<p class="id">{station.challenge.challengeId}</p>
							<h3>
								{getChallengeValue(station.challenge)}
								{station.attempts.length === 1
									? station.attempts.find((a) => a.teamId === selectedTeamId)
										? ' • You failed'
										: ' • Opponent failed'
									: ''}
							</h3>

							<button
								class="ghost-button"
								type="button"
								data-vaul-no-drag
								onclick={() => openGoogleMaps(station.googleMapsUrl)}
							>
								Google Maps
							</button>

							{#if !station.attempts.find((a) => a.teamId === selectedTeamId)}
								<button
									class="primary-button"
									data-vaul-no-drag
									disabled={!selectedTeamId || !gameStarted}
									onclick={() => (showComplete = true)}
								>
									Completed
								</button>
								<button
									class="ghost-button"
									data-vaul-no-drag
									disabled={!selectedTeamId || !gameStarted}
									onclick={() => (showFail = true)}
								>
									Failed
								</button>
							{/if}
						</div>
					{/if}

					<h3>Deposit History</h3>
					<div class="list">
						{#each station.deposits as deposit (deposit.id)}
							<div>
								<strong>{deposit.teamName}</strong>
								<span>Deposit {deposit.amount}</span>
								<small>{formatTimestamp(deposit.createdAt)}</small>
							</div>
						{/each}
						{#if station.deposits.length === 0}
							<p>No deposits yet.</p>
						{/if}
					</div>
				</Drawer.Content>
			</Drawer.Portal>

			<ActionDrawer
				open={showDeposit}
				title="Deposit chips"
				onClose={() => (showDeposit = false)}
				numberInput="Amount to Deposit"
				onConfirm={async (amount) => {
					const result = await depositStation(station.id, amount);
					openShareMenu(result);
					showDeposit = false;
				}}
			/>

			<ActionDrawer
				open={showDebt}
				title="Confirm Debt"
				description="Go into debt to be able to travel to this station?"
				onClose={() => (showDebt = false)}
				onConfirm={async () => {
					const result = await debtStation(
						station.ownership.ownerTeamId ?? null,
						station.id,
						station.ownership.margin
					);
					openShareMenu(result);
					showDebt = false;
				}}
			/>

			{#if station.challenge?.isActive}
				<ActionDrawer
					open={showComplete}
					title="Complete challenge"
					numberInput={station.challenge.type === 'call-your-shot' ? 'Units Completed' : undefined}
					onClose={() => (showComplete = false)}
					onConfirm={async (amount) => {
						const result = await completeChallenge(
							station.id,
							station.challenge.challengeId,
							amount
						);
						openShareMenu(result);
						showComplete = false;
					}}
				/>
			{/if}

			{#if station.challenge?.isActive}
				<ActionDrawer
					open={showFail}
					title="Fail challenge"
					onClose={() => (showFail = false)}
					onConfirm={async () => {
						const result = await failChallenge(station.id, station.challenge.challengeId);
						openShareMenu(result);
						showFail = false;
					}}
				/>
			{/if}
		{/if}
	</Drawer.Root>
{/key}

<style>
	:global {
		.overlay {
			position: fixed;
			inset: 0;
			z-index: 8;
			background: rgba(52, 37, 18, 0.3);
		}

		.panel {
			padding: 1rem;
			background: var(--panel);
			backdrop-filter: blur(12px);
			border: 1px solid var(--line);
			border-radius: 24px;
			box-shadow: var(--shadow);
			position: fixed;
			right: 0.75rem;
			bottom: 0.75rem;
			left: 0.75rem;
			z-index: 9;
			max-height: min(62vh, 36rem);
			overflow: clip;
		}

		.title {
			margin: 0;
			font-family: 'Permanent Marker', cursive;
		}

		.actions {
			display: flex;
			gap: 0.65rem;
			align-items: center;
			flex-wrap: wrap;
		}

		.card {
			margin-top: 0.75rem;
			padding: 0.8rem;
			background: var(--panel-strong);
			border: 1px solid var(--line);
			border-radius: 18px;
		}

		.list {
			display: grid;
			gap: 0.65rem;
		}

		.list > div {
			display: grid;
			grid-template-columns: 1fr auto;
			gap: 0.2rem 0.8rem;
			padding-bottom: 0.45rem;
			border-bottom: 1px dashed var(--line);
		}

		@media (min-width: 960px) {
			.sheet {
				left: auto;
				right: 1rem;
				bottom: 1rem;
				width: 22rem;
				max-height: calc(100vh - 2rem);
			}
		}

		.id {
			font-size: 0.7rem;
			opacity: 0.8;
			user-select: all;
		}
	}
</style>
