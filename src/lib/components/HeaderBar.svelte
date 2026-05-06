<script lang="ts">
	import type { TeamSummary } from '$lib/game/types';
	import { EllipsisVertical } from '@lucide/svelte';

	let {
		teams = [],
		selectedTeamId = null,
		showMenu = $bindable(),
		onReplicateTeam
	}: {
		teams: TeamSummary[];
		selectedTeamId?: string | null;
		onReplicateTeam: (teamId: string) => void;
		showMenu: boolean;
	} = $props();
</script>

<header class="header-bar">
	{#each teams as team (team.id)}
		<button
			class="action team"
			style:--team-color={team.color}
			onclick={() => onReplicateTeam(team.id)}
		>
			<strong>{team.name}{selectedTeamId && team.id === selectedTeamId ? ' (you)' : ''}</strong>
			<span>{team.controlledStations}s • {team.balance}c</span>
		</button>
	{/each}
	<button class="action more-button" onclick={() => (showMenu = true)}>
		<EllipsisVertical />
	</button>
</header>

<style>
	.header-bar {
		overflow-x: auto;
		display: flex;
		gap: 0.5rem;
		min-width: max-content;
	}

	.action {
		display: grid;
		grid-template-columns: auto auto;
		gap: 0.1rem 0.45rem;
		align-items: center;
		padding: 0.55rem 0.7rem;
		border-radius: 18px;
		font-size: 0.84rem;
		justify-content: center;
	}

	.team {
		justify-content: start;
		width: stretch;
		min-width: 6.5rem;
		background: color-mix(in srgb, var(--team-color) 30%, #ffffff);
		text-wrap: nowrap;
		text-overflow: ellipsis;
		border: 2px solid black;
	}

	.team strong {
		grid-column: 1 / -1;
		font-size: 0.88rem;
	}

	.more-button {
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
