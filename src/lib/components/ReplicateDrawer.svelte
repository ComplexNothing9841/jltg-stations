<script lang="ts">
	import type { ActionSummary, TeamSummary } from '$lib/game/types';
	import type { ChallengeType } from '$lib/config/schema';
	import { getRawState } from '$lib/db/repository';
	import { Drawer } from 'vaul-svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let {
		open = $bindable(false),
		teams = [],
		replicatingTeamId = null,
		onReplicate
	}: {
		open?: boolean;
		teams?: TeamSummary[];
		replicatingTeamId?: string | null;
		onReplicate: (input: ActionSummary) => void | Promise<void>;
	} = $props();

	const isDesktop = new MediaQuery('(min-width: 1024px)');
	let kind = $state<ActionSummary['kind']>('deposit');
	let teamId = $derived(replicatingTeamId ?? '');
	let stationId = $state('');
	let challengeId = $state('');
	let amount = $state(1);
	let quantity = $state(1);
	let spawnedChallengeIds = $state('');
	let challengeType = $state<ChallengeType | null>(null);
	let errorMessage = $state<string | null>(null);
	let clearTimer: ReturnType<typeof setTimeout> | null = null;
	let challengeLookupToken = 0;

	function clearError() {
		errorMessage = null;
		if (clearTimer) {
			clearTimeout(clearTimer);
			clearTimer = null;
		}
	}

	const replicatingTeam = $derived(teams.find((team) => team.id === teamId) ?? null);

	$effect(() => {
		const shouldLookup =
			kind === 'complete' || kind === 'fail' ? challengeId.trim().length > 0 : false;
		if (!shouldLookup) {
			challengeType = null;
			return;
		}

		const token = ++challengeLookupToken;
		const id = challengeId.trim();

		void (async () => {
			try {
				const raw = await getRawState();
				if (token !== challengeLookupToken) return;
				const challenge = raw.challenges.find((entry) => entry.id === id);
				challengeType = (challenge?.type as ChallengeType | undefined) ?? null;
			} catch {
				if (token !== challengeLookupToken) return;
				challengeType = null;
			}
		})();
	});

	async function submit() {
		clearError();
		try {
			await onReplicate({
				kind,
				teamId,
				stationId,
				challengeId: challengeId || undefined,
				amount: kind === 'deposit' ? Number(amount) : undefined,
				quantity: kind === 'complete' ? Number(quantity) : undefined,
				spawnedChallengeIds:
					kind === 'deposit'
						? []
						: spawnedChallengeIds
								.split(',')
								.map((value) => value.trim())
								.filter(Boolean)
			});
			stationId = '';
			challengeId = '';
			spawnedChallengeIds = '';
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Action failed.';
			clearTimer = setTimeout(() => {
				errorMessage = null;
				clearTimer = null;
			}, 6000);
		}
	}
</script>

<Drawer.Root bind:open direction={isDesktop.current ? 'right' : 'bottom'}>
	<Drawer.Portal>
		<Drawer.Overlay class="drawer-overlay" onclick={() => (open = false)} />
		<Drawer.Content class="drawer-menu">
			<Drawer.Title class="drawer-title">Replicate action</Drawer.Title>
			<Drawer.Description class="drawer-description">
				Enter a manual action so another device can mirror the state change.
			</Drawer.Description>
			{#if errorMessage}
				<div class="drawer-error" role="alert">
					<span>{errorMessage}</span>
					<button type="button" class="clear-error" onclick={clearError}>X</button>
				</div>
			{/if}
			{#if replicatingTeam}
				<div class="team-card" style:--team-color={replicatingTeam.color} data-vaul-no-drag>
					<strong>{replicatingTeam.name}</strong>
					<span
						>{replicatingTeam.controlledStations} stations • {replicatingTeam.balance} chips</span
					>
				</div>
			{/if}
			<label data-vaul-no-drag>
				Action
				<select bind:value={kind}>
					<option value="deposit">Deposit</option>
					<option value="complete">Complete challenge</option>
					<option value="fail">Fail challenge</option>
					<option value="giveDebt">Gives you debt</option>
				</select>
			</label>
			{#if kind === 'deposit' || kind === 'giveDebt'}
				<label>
					Station ID
					<input bind:value={stationId} placeholder="1234" data-vaul-no-drag />
				</label>
				{#if kind === 'deposit'}
					<label data-vaul-no-drag>
						Chips deposited
						<input bind:value={amount} min="1" step="1" type="number" />
					</label>
				{/if}
			{:else}
				<label data-vaul-no-drag>
					Challenge ID
					<input bind:value={challengeId} placeholder="challenge-4" />
				</label>
				{#if kind === 'complete' && challengeType === 'call-your-shot'}
					<label data-vaul-no-drag>
						Call-your-shot unit count
						<input bind:value={quantity} min="1" step="1" type="number" />
					</label>
				{/if}
				<label data-vaul-no-drag>
					New on-board challenge IDs
					<input bind:value={spawnedChallengeIds} placeholder="comma,separated,ids" />
				</label>
			{/if}
			<button
				class="primary-button"
				type="button"
				disabled={!teamId ||
					(kind === 'deposit' || kind === 'giveDebt' ? !stationId : !challengeId)}
				onclick={submit}
			>
				Apply action
			</button>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	:global(.drawer-overlay) {
		position: fixed;
		inset: 0;
		z-index: 14;
		background: rgba(52, 37, 18, 0.3);
	}

	:global(.drawer-menu) {
		position: fixed;
		z-index: 15;
		top: 0.75rem;
		right: 0.75rem;
		bottom: 0.75rem;
		width: min(24rem, calc(100vw - 1.5rem));
		padding: 1rem;
		background: var(--panel);
		backdrop-filter: blur(12px);
		border: 1px solid var(--line);
		border-radius: 24px;
		box-shadow: var(--shadow);
		overflow: clip;
	}

	:global(.drawer-title) {
		margin: 0;
		font-family: 'Permanent Marker', cursive;
	}

	:global(.drawer-description) {
		margin: 0.2rem 0 0;
		color: var(--muted);
		font-size: 0.82rem;
	}

	:global(.drawer-menu label) {
		display: grid;
		gap: 0.35rem;
		margin: 0.75rem 0;
	}

	:global(.drawer-menu .team-card) {
		display: grid;
		gap: 0.2rem;
		margin-top: 0.75rem;
		padding: 0.65rem 0.75rem;
		border-radius: 14px;
		border: 1px solid color-mix(in srgb, var(--team-color) 40%, #6c4f2c);
		background: color-mix(in srgb, var(--team-color) 28%, #ffffff);
	}

	:global(.drawer-menu) {
		margin: 0.75rem 0;
		color: var(--muted);
		font-size: 0.9rem;
	}

	:global(.drawer-menu input),
	:global(.drawer-menu select) {
		width: 100%;
		box-sizing: border-box;
		padding: 0.72rem 0.85rem;
		background: white;
		border: 1px solid var(--line);
		border-radius: 14px;
	}

	:global(.drawer-error) {
		margin-top: 0.75rem;
		padding: 0.55rem 0.7rem;
		background: #fff0ef;
		border: 1px solid #f4b4af;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	:global(.clear-error) {
		background: transparent;
		border: 0;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		font: inherit;
	}

	@media (max-width: 959px) {
		:global(.drawer-menu) {
			top: auto;
			left: 0.75rem;
			right: 0.75rem;
			bottom: 0.75rem;
			width: auto;
			max-height: min(70vh, 38rem);
		}
	}
</style>
