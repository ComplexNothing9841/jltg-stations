<script lang="ts">
	import {
		game,
		initGame,
		refreshGame,
		replicateManual,
		resetAllData,
		setupGame
	} from '$lib/game/game.svelte';
	import HeaderBar from '$lib/components/HeaderBar.svelte';
	import GameMap from '$lib/components/GameMap.svelte';
	import StationDrawer from '$lib/components/StationDrawer.svelte';
	import SetupDrawer from '$lib/components/SetupDrawer.svelte';
	import ReplicateDrawer from '$lib/components/ReplicateDrawer.svelte';
	import MoreDrawer from '$lib/components/MoreDrawer.svelte';
	import ActionShareDrawer from '$lib/components/ActionShareDrawer.svelte';
	import ResetDataDrawer from '$lib/components/ResetDataDrawer.svelte';
	import { exportGameData } from '$lib/game/export';
	import { buildShareMessage } from '$lib/game/share';
	import type { ActionResult } from '$lib/game/types';
	import type { MapDownloadPreset } from '$lib/config/assets';
	import { getMapOverlayLabel, toEpochMs } from '$lib/utils.js';

	let initialized = $state(false);
	let showMoreMenu = $state(false);
	let showReplicateMenu = $state(false);
	let replicatingTeamId = $state<string | null>(null);
	let selectedStationId = $state<string | null>(null);
	let generatedStartingChallengeIds = $state<string[] | null>(null);
	let setupInFlight = $state(false);
	let shareMenuMessage: string | null = $state(null);
	let showResetDrawer = $state(false);
	let tileCacheProgress = $state<{ cachedCount: number; totalCount: number } | null>(null);
	let nowMs = $state(Date.now());
	let zoom: number | null = $state(null);
	let center: [number, number] | null = $state(null);

	const selectedStation = $derived(
		selectedStationId ? (game.stationDetailsById[selectedStationId] ?? null) : null
	);
	const dayDetails = $derived.by(() => {
		const session = game.session;
		if (!session) return null;
		return getMapOverlayLabel({
			startTimestamp: session.startTimestamp,
			gameStarted: session.gameStarted,
			currentDay: session.currentDay,
			nowMs
		});
	});

	$effect(() => {
		let exactStartTimer: ReturnType<typeof setTimeout> | null = null;

		const scheduleExactStart = () => {
			if (exactStartTimer) {
				clearTimeout(exactStartTimer);
				exactStartTimer = null;
			}
			const session = game.session;
			if (!session?.startTimestamp || session.gameStarted) return;
			const delayMs = toEpochMs(session.startTimestamp) - Date.now();
			if (delayMs <= 0) {
				void refreshGame();
				return;
			}
			if (delayMs <= 60_000) {
				exactStartTimer = setTimeout(() => {
					nowMs = Date.now();
					void refreshGame();
					exactStartTimer = null;
				}, delayMs);
			}
		};

		scheduleExactStart();
		const timer = setInterval(() => {
			nowMs = Date.now();
			void refreshGame();
			scheduleExactStart();
		}, 60 * 1000);
		return () => {
			clearInterval(timer);
			if (exactStartTimer) {
				clearTimeout(exactStartTimer);
			}
		};
	});

	$effect(() => {
		if (initialized) return;
		initialized = true;
		void initGame();
	});

	function openShareMenu(result: ActionResult | null) {
		if (!result) return;
		selectedStationId = 'giveSummary' in result ? result.giveSummary.stationId : result.stationId;
		shareMenuMessage = buildShareMessage(result);
	}
</script>

<svelte:head>
	<title>Rail Rush Station Tracker</title>
</svelte:head>

{#if game.error}
	<div class="error-banner">{game.error}</div>
{/if}
{#if game.ready}
	<div class="app-shell">
		<div class="main-shell">
			<div class="map-column">
				{#if !!game.session}
					<div class="mobile-header">
						<HeaderBar
							teams={game.teams}
							selectedTeamId={game.session?.selectedTeamId ?? null}
							onReplicateTeam={(teamId) => {
								if (teamId === game.session?.selectedTeamId) return;
								replicatingTeamId = teamId;
								showReplicateMenu = true;
							}}
							bind:showMenu={showMoreMenu}
						/>
					</div>
				{/if}
				<GameMap
					session={game.session}
					stations={game.stations}
					overlayLabel={dayDetails}
					bind:selectedStationId
					bind:zoom
					bind:center
				/>
			</div>
			<aside class="desktop-sidebar">
				{#if !game.setupRequired}
					<div class="sidebar-card">
						<p class="sidebar-value">{dayDetails}</p>
					</div>
				{/if}
				<div class="sidebar-card">
					<p class="sidebar-label">Teams</p>
					<div class="sidebar-teams">
						{#each game.teams as team (team.id)}
							<article class="sidebar-team" style:--team-color={team.color}>
								<strong
									>{team.name}{game.session?.selectedTeamId &&
									team.id === game.session?.selectedTeamId
										? ' (you)'
										: ''}</strong
								>
								<span>{team.controlledStations} stations • {team.balance} chips</span>
								{#if game.session?.selectedTeamId && team.id !== game.session.selectedTeamId}
									<button
										class="replicate-button"
										onclick={() => {
											replicatingTeamId = team.id;
											showReplicateMenu = true;
										}}>Replicate Action</button
									>
								{/if}
							</article>
						{/each}
					</div>
				</div>
				{#if game.stats}
					<div class="sidebar-card">
						<p class="sidebar-label">Stats</p>
						<p class="sidebar-stat-total">Total investment: {game.stats.totalInvestment}</p>
						<div class="sidebar-stats">
							{#each game.stats.teamStats as teamStat (teamStat.teamId)}
								<article class="sidebar-stat-row" style:--team-color={teamStat.teamColor}>
									<strong>{teamStat.teamName}</strong>
									<p>Invested: {teamStat.totalInvestment}</p>
									<p>Wasted: {teamStat.wastedChips}</p>
									<p>Extra: {teamStat.extraChips}</p>
									<p>Efficient: {teamStat.efficientChips}</p>
								</article>
							{/each}
						</div>
					</div>
				{/if}
				{#if !game.setupRequired}
					<button class="desktop-export-button" onclick={exportGameData}> Export Game Data </button>
					<button class="desktop-reset-button" onclick={() => (showResetDrawer = true)}>
						Reset All Data
					</button>
				{/if}
			</aside>
		</div>
	</div>

	<StationDrawer
		bind:stationId={selectedStationId}
		station={selectedStation}
		selectedTeamId={game.session?.selectedTeamId ?? null}
		canDebt={selectedStation?.ownership.ownerTeamId !== game.session?.selectedTeamId &&
			(selectedStation?.ownership.margin ?? 0) >
				(game.teams.find((t) => t.id === game.session?.selectedTeamId)?.balance ?? 0) &&
			!!game.session?.gameStarted}
		gameStarted={game.session?.gameStarted ?? false}
		{openShareMenu}
	/>

	<SetupDrawer
		open={game.setupRequired || setupInFlight || !!generatedStartingChallengeIds}
		teams={game.teams}
		configLoaded={!!game.session}
		teamSelected={!!game.session?.selectedTeamId}
		initialBoardSize={game.session?.config.rules.initialBoardSize ?? 0}
		initialStartTimestamp={game.session?.startTimestamp ?? null}
		{generatedStartingChallengeIds}
		{tileCacheProgress}
		onSetup={async ({
			configUrl,
			selectedTeamId,
			startMode,
			startingChallengeIds,
			startTimestamp,
			mapDownloadPreset
		}) => {
			setupInFlight = true;
			if (configUrl) {
				tileCacheProgress = { cachedCount: 0, totalCount: 0 };
			}
			try {
				generatedStartingChallengeIds = await setupGame(
					configUrl,
					selectedTeamId,
					startMode,
					startingChallengeIds,
					startTimestamp,
					(mapDownloadPreset ?? 'full') as MapDownloadPreset,
					(progress) => (tileCacheProgress = progress)
				);
			} finally {
				setupInFlight = false;
				tileCacheProgress = null;
			}
		}}
		onDismissGenerated={() => (generatedStartingChallengeIds = null)}
	/>

	<ReplicateDrawer
		bind:open={showReplicateMenu}
		teams={game.teams}
		{replicatingTeamId}
		onReplicate={async (input) => {
			const station = game.stations.find((entry) => entry.id === input.stationId);
			if (!station || !game.session) return;
			center = [station.longitude, station.latitude];
			zoom = Math.max(game.session.config.map.initialView.zoom, 12);
			selectedStationId = input.stationId;
			await replicateManual(input);
		}}
	/>

	<MoreDrawer
		bind:open={showMoreMenu}
		stats={game.stats}
		onExport={exportGameData}
		onReset={() => {
			showResetDrawer = true;
		}}
	/>
	<ResetDataDrawer
		bind:open={showResetDrawer}
		loading={game.loading}
		onConfirm={async () => {
			await resetAllData();
			showMoreMenu = false;
			showReplicateMenu = false;
			replicatingTeamId = null;
			selectedStationId = null;
			showResetDrawer = false;
			shareMenuMessage = null;
		}}
	/>
	<ActionShareDrawer bind:message={shareMenuMessage} />
{/if}

<style>
	.error-banner {
		margin: 0.75rem;
		padding: 0.9rem 1rem;
		background: #fff0ef;
		border: 1px solid #f4b4af;
		border-radius: 18px;
	}

	.app-shell {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		gap: 0.5rem;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.main-shell {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
	}

	.map-column {
		display: flex;
		flex: 1 1 auto;
		min-height: 0;
		flex-direction: column;
		gap: 0.5rem;
	}

	.desktop-sidebar {
		display: none;
	}

	.sidebar-card {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 18px;
		padding: 0.75rem;
	}

	.sidebar-label {
		margin: 0;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.sidebar-value {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
	}

	.sidebar-teams,
	.sidebar-stats {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.6rem;
	}

	.sidebar-team {
		display: grid;
		gap: 0.2rem;
		text-align: left;
		border-radius: 14px;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--team-color) 22%, #ffffff);
		padding: 0.55rem 0.65rem;
	}

	.replicate-button {
		background: color-mix(in srgb, var(--team-color) 60%, #ffffff);
		color: contrast-color(color-mix(in srgb, var(--team-color) 60%, #ffffff));
		border-radius: 999px;
		padding: 0.7rem 1rem;
		cursor: pointer;
		border: 0;
		margin-top: 0.5rem;
	}

	.sidebar-stat-total {
		margin: 0.45rem 0 0;
	}

	.sidebar-stat-row {
		margin: 0;
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 0.55rem 0.65rem;
		background: var(--panel-strong);
		display: grid;
		gap: 0.2rem;
		text-align: left;
		background: color-mix(in srgb, var(--team-color) 22%, #ffffff);
	}

	.sidebar-stat-row p {
		margin: 0.25rem 0 0;
		font-size: 0.9rem;
	}

	@media (min-width: 960px) {
		.app-shell {
			gap: 0.5rem;
			padding: 1rem;
		}

		.mobile-header {
			display: none;
		}

		.main-shell {
			display: grid;
			grid-template-columns: minmax(0, 2fr) minmax(20rem, 1fr);
			gap: 1rem;
		}

		.desktop-sidebar {
			display: grid;
			align-content: start;
			gap: 0.75rem;
			max-height: 100%;
			overflow-y: auto;
		}
	}

	.desktop-export-button {
		border: 1px solid var(--line);
		background: var(--panel);
		color: inherit;
		border-radius: 999px;
		padding: 0.75rem 1rem;
		font-weight: 600;
		cursor: pointer;
		margin-top: auto;
	}

	.desktop-reset-button {
		border: 1px solid color-mix(in srgb, #a00024 30%, var(--line));
		background: color-mix(in srgb, #a00024 12%, var(--panel));
		color: inherit;
		border-radius: 999px;
		padding: 0.75rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}
</style>
