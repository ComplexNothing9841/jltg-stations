<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import ShareButton from './ShareButton.svelte';
	import type { TeamSummary } from '$lib/game/types';
	import type { MapDownloadPreset } from '$lib/config/assets';
	import { MediaQuery } from 'svelte/reactivity';

	type SetupPayload = {
		configUrl: string;
		selectedTeamId: string;
		startMode?: 'generate' | 'input';
		startingChallengeIds?: string[];
		startTimestamp?: number | null;
		mapDownloadPreset?: MapDownloadPreset;
	};

	let {
		open = false,
		teams = [],
		configLoaded = false,
		teamSelected = false,
		initialBoardSize = 0,
		initialStartTimestamp = null,
		generatedStartingChallengeIds = null,
		tileCacheProgress = null,
		onSetup,
		onDismissGenerated
	}: {
		open?: boolean;
		teams?: TeamSummary[];
		configLoaded?: boolean;
		teamSelected?: boolean;
		initialBoardSize?: number;
		initialStartTimestamp?: number | null;
		generatedStartingChallengeIds?: string[] | null;
		tileCacheProgress?: { cachedCount: number; totalCount: number } | null;
		onSetup: (payload: SetupPayload) => void;
		onDismissGenerated: () => void;
	} = $props();

	const isDesktop = new MediaQuery('(min-width: 1024px)');
	let configUrl = $state('https://jltg-stations.pages.dev/taiwan.json');
	let selectedTeamId = $derived(teams[0].id);
	let startMode = $state<'generate' | 'input'>('generate');
	let startingChallengeIds = $state('');
	let startTimestampInput = $derived(toDatetimeLocalValue(initialStartTimestamp));
	let loading = $state(false);
	let mapDownloadPreset = $state<MapDownloadPreset>('medium');

	const setupStage = $derived(
		generatedStartingChallengeIds
			? 'share'
			: !configLoaded
				? 'config'
				: !teamSelected
					? 'team'
					: 'board'
	);
	const generatedIdsText = $derived(generatedStartingChallengeIds?.join(', ') ?? '');

	function toDatetimeLocalValue(unixSeconds: number | null | undefined) {
		if (!unixSeconds) return '';
		const date = new Date(unixSeconds * 1000);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	function parseDatetimeLocalToUnixSeconds(value: string) {
		if (!value.trim()) return null;
		const ms = new Date(value).getTime();
		return Number.isFinite(ms) ? Math.floor(ms / 1000) : NaN;
	}

	$effect(() => {
		if (setupStage !== 'config') {
			loading = false;
		}
	});
</script>

<Drawer.Root {open} dismissible={false} direction={isDesktop.current ? 'right' : 'bottom'}>
	<Drawer.Portal>
		<Drawer.Overlay class="setup-backdrop" />
		<Drawer.Content class="setup-drawer" data-vaul-no-drag>
			<Drawer.Title class="setup-title">
				{#if setupStage === 'config'}
					First-run setup
				{:else if setupStage === 'team'}
					Choose local team
				{:else if setupStage === 'board'}
					Opening board
				{:else}
					Share opening board
				{/if}
			</Drawer.Title>
			<Drawer.Description class="setup-description">
				{#if setupStage === 'config'}
					Enter the config URL to download the game definition and cache its map assets.
				{:else if setupStage === 'team'}
					Pick which team this device represents.
				{:else if setupStage === 'board'}
					Choose whether this device should generate the first {initialBoardSize} challenges or mirror
					a list from another team.
				{:else}
					Share these opening challenge IDs with the other team
				{/if}
			</Drawer.Description>

			{#if setupStage === 'config'}
				<label data-vaul-no-drag>
					Config URL
					<input
						bind:value={configUrl}
						placeholder="https://example.com/game.json"
						type="url"
						disabled={loading}
						data-vaul-no-drag
					/>
				</label>
				<div class="preset-group" data-vaul-no-drag>
					<p>Map download size</p>
					<small>tip: any parts of the map you view while online will also be downloaded</small>
					<div class="preset-tabs">
						<button
							type="button"
							disabled={loading}
							aria-pressed={mapDownloadPreset === 'minimal'}
							class:active={mapDownloadPreset === 'minimal'}
							onclick={() => (mapDownloadPreset = 'minimal')}
						>
							Minimal
						</button>
						<button
							type="button"
							disabled={loading}
							aria-pressed={mapDownloadPreset === 'medium'}
							class:active={mapDownloadPreset === 'medium'}
							onclick={() => (mapDownloadPreset = 'medium')}
						>
							Medium
						</button>
						<button
							type="button"
							disabled={loading}
							aria-pressed={mapDownloadPreset === 'full'}
							class:active={mapDownloadPreset === 'full'}
							onclick={() => (mapDownloadPreset = 'full')}
						>
							Full
						</button>
					</div>
				</div>
				{#if loading && tileCacheProgress}
					<div class="progress-wrap" data-vaul-no-drag>
						<div class="progress-label">
							<span>Caching map tiles</span>
							<span>{tileCacheProgress.cachedCount}/{tileCacheProgress.totalCount}</span>
						</div>
						<progress
							max={Math.max(tileCacheProgress.totalCount, 1)}
							value={tileCacheProgress.cachedCount}
						></progress>
					</div>
				{/if}
			{/if}

			{#if setupStage === 'team'}
				<label data-vaul-no-drag>
					Local team
					<select bind:value={selectedTeamId} data-vaul-no-drag>
						<option value="">Choose a team</option>
						{#each teams as team (team.id)}
							<option value={team.id}>{team.name}</option>
						{/each}
					</select>
				</label>
				<label data-vaul-no-drag>
					Game start date/time
					<small>Leave blank to start now</small>
					<input type="datetime-local" bind:value={startTimestampInput} data-vaul-no-drag />
				</label>
			{/if}

			{#if setupStage === 'board'}
				<label data-vaul-no-drag>
					Opening board source
					<select bind:value={startMode} data-vaul-no-drag>
						<option value="generate">Generate on this device</option>
						<option value="input">Input list from another team</option>
					</select>
				</label>
				{#if startMode === 'input'}
					<label data-vaul-no-drag>
						Starting challenge IDs
						<input
							bind:value={startingChallengeIds}
							placeholder="comma,separated,challenge,ids"
							data-vaul-no-drag
						/>
					</label>
				{/if}
			{/if}

			{#if setupStage === 'share'}
				Generated challenge IDs
				<div class="generated-ids" data-vaul-no-drag>
					{generatedIdsText}
				</div>
				<div class="modal-actions">
					<ShareButton payload={generatedIdsText} label="Share opening board" />
					<button
						class="primary-button"
						type="button"
						onclick={onDismissGenerated}
						data-vaul-no-drag
					>
						Done
					</button>
				</div>
			{/if}

			{#if setupStage !== 'share'}
				<button
					class="primary-button"
					type="button"
					disabled={(setupStage === 'config' && !configUrl) ||
						(setupStage === 'team' && !selectedTeamId) ||
						(setupStage === 'board' && startMode === 'input' && !startingChallengeIds) ||
						loading}
					onclick={() => {
						if (setupStage === 'config') {
							loading = true;
						}
						return onSetup({
							configUrl: setupStage === 'config' ? configUrl : '',
							selectedTeamId: setupStage === 'team' ? selectedTeamId : '',
							startMode: setupStage === 'board' ? startMode : undefined,
							startingChallengeIds:
								setupStage === 'board' && startMode === 'input'
									? startingChallengeIds
											.split(',')
											.map((value) => value.trim())
											.filter(Boolean)
									: undefined,
							startTimestamp:
								setupStage === 'team'
									? parseDatetimeLocalToUnixSeconds(startTimestampInput)
									: undefined,
							mapDownloadPreset: setupStage === 'config' ? mapDownloadPreset : undefined
						});
					}}
					data-vaul-no-drag
				>
					{#if setupStage === 'config'}
						{loading ? 'Downloading config...' : 'Download config'}
					{:else if setupStage === 'team'}
						Save team
					{:else if startMode === 'generate'}
						Generate opening board
					{:else}
						Use provided board
					{/if}
				</button>
			{/if}
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	:global(.setup-backdrop) {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgba(52, 37, 18, 0.3);
	}

	:global(.setup-drawer) {
		position: fixed;
		right: 0.75rem;
		bottom: 0.75rem;
		left: 0.75rem;
		z-index: 21;
		padding: 1rem;
		background: var(--panel);
		backdrop-filter: blur(12px);
		border: 1px solid var(--line);
		border-radius: 24px;
		box-shadow: var(--shadow);
		overflow: clip;
	}

	:global(.setup-title) {
		margin: 0;
		font-family: 'Permanent Marker', cursive;
	}

	:global(.setup-description) {
		margin: 0.4rem 0 0;
		color: var(--muted);
	}

	:global(.setup-drawer label) {
		display: grid;
		gap: 0.35rem;
		margin: 0.75rem 0;
	}

	:global(.setup-drawer input),
	:global(.setup-drawer select),
	:global(.setup-drawer .generated-ids) {
		padding: 0.72rem 0.85rem;
		background: white;
		border: 1px solid var(--line);
		border-radius: 14px;
	}

	.generated-ids {
		user-select: all;
	}

	.preset-group p {
		margin: 0.2rem 0 0.2rem;
	}

	.preset-tabs {
		margin-top: 0.5rem;
		margin-bottom: 0.75rem;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.preset-tabs button {
		padding: 0.55rem 0.6rem;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: white;
	}

	.preset-tabs button.active {
		background: #f6dfb4;
		border-color: #d8ae62;
		font-weight: 600;
	}

	.progress-wrap {
		margin-top: 0.6rem;
	}

	.progress-label {
		display: flex;
		justify-content: space-between;
		font-size: 0.85rem;
		margin-bottom: 0.35rem;
	}

	.progress-wrap progress {
		width: 100%;
		height: 0.8rem;
	}

	.modal-actions {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		flex-wrap: wrap;
	}

	@media (min-width: 960px) {
		:global(.setup-drawer) {
			left: auto;
			width: min(34rem, calc(100vw - 2rem));
		}
	}
</style>
