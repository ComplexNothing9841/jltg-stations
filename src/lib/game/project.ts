import { buildGoogleMapsUrl, resolveStartTimestamp } from '$lib/utils';
import type { ChallengeType } from '$lib/config/schema';
import { computeStationOwnership } from './rules';
import type {
	ActionSummary,
	BootstrapMetadata,
	SelectedStationView,
	StationSummary,
	StatsSummary,
	TeamSummary
} from './types';
import type { getRawState } from '$lib/db/repository';

type RawState = Awaited<ReturnType<typeof getRawState>>;

const DAY_MS = 24 * 60 * 60 * 1000;

function computeGameClock(raw: RawState) {
	const startTimestamp = resolveStartTimestamp(raw.gameStartTimestamp, raw.config?.startTimestamp);
	if (!startTimestamp) {
		return { startTimestamp: null, gameStarted: true, currentDay: 1 };
	}
	const startMs = startTimestamp * 1000;
	if (Date.now() < startMs) {
		return { startTimestamp, gameStarted: false, currentDay: 1 };
	}
	const elapsedDays = Math.floor((Date.now() - startMs) / DAY_MS);
	return { startTimestamp, gameStarted: true, currentDay: elapsedDays + 1 };
}

export function projectGameState(raw: RawState, bootstrap: BootstrapMetadata | null) {
	const config = raw.config;
	if (!config) {
		return {
			session: null,
			teams: [] as TeamSummary[],
			stations: [] as StationSummary[]
		};
	}

	const teamColorMap = new Map(raw.teams.map((team) => [team.id, team.color]));
	const rewardByTeam = new Map<string, number>();
	for (const attempt of raw.attempts) {
		rewardByTeam.set(attempt.teamId, (rewardByTeam.get(attempt.teamId) ?? 0) + attempt.rewardDelta);
	}

	const depositsByStation = new Map<string, Record<string, number>>();
	const spentByTeam = new Map<string, number>();
	for (const deposit of raw.deposits) {
		const stationDeposits = depositsByStation.get(deposit.stationId) ?? {};
		stationDeposits[deposit.teamId] = (stationDeposits[deposit.teamId] ?? 0) + deposit.amount;
		depositsByStation.set(deposit.stationId, stationDeposits);
		spentByTeam.set(deposit.teamId, (spentByTeam.get(deposit.teamId) ?? 0) + deposit.amount);
	}

	for (const debtRaw of raw.actions.filter((a) => a.kind === 'giveDebt')) {
		const debt = JSON.parse(debtRaw.payload) as ActionSummary;
		if (debt.amount)
			spentByTeam.set(debt.teamId, (spentByTeam.get(debt.teamId) ?? 0) + debt.amount);
	}
	for (const debtRaw of raw.actions.filter((a) => a.kind === 'receiveDebt')) {
		const debt = JSON.parse(debtRaw.payload) as ActionSummary;
		if (debt.amount)
			rewardByTeam.set(debt.teamId, (rewardByTeam.get(debt.teamId) ?? 0) + debt.amount);
	}

	const stationOwnership = new Map<string, StationSummary['ownership']>();
	for (const station of raw.stations) {
		const ownership = computeStationOwnership(depositsByStation.get(station.id) ?? {});
		stationOwnership.set(station.id, {
			...ownership,
			ownerColor: ownership.ownerTeamId ? (teamColorMap.get(ownership.ownerTeamId) ?? null) : null
		});
	}

	const controlledByTeam = new Map<string, number>();
	for (const ownership of stationOwnership.values()) {
		if (ownership.ownerTeamId) {
			controlledByTeam.set(
				ownership.ownerTeamId,
				(controlledByTeam.get(ownership.ownerTeamId) ?? 0) + 1
			);
		}
	}

	const teams = raw.teams.map((team) => ({
		id: team.id,
		name: team.name,
		color: team.color,
		balance:
			config.rules.startingChipBalance +
			(rewardByTeam.get(team.id) ?? 0) -
			(spentByTeam.get(team.id) ?? 0),
		controlledStations: controlledByTeam.get(team.id) ?? 0
	}));

	const challengeMap = new Map(raw.challenges.map((challenge) => [challenge.id, challenge]));
	const activeBoardByStationId = new Map<string, { boardId: string; challengeId: string }>();
	const gameClock = computeGameClock(raw);
	for (const board of raw.boardChallenges.filter(
		(entry) => entry.status === 'active' && gameClock.gameStarted
	)) {
		const challenge = challengeMap.get(board.challengeId);
		if (challenge) {
			activeBoardByStationId.set(challenge.stationId, {
				boardId: board.id,
				challengeId: challenge.id
			});
		}
	}

	const stations = raw.stations.map((station) => {
		const challengeRef = activeBoardByStationId.get(station.id);
		const challenge =
			(challengeRef ? challengeMap.get(challengeRef.challengeId) : undefined) ??
			raw.challenges.find((entry) => entry.stationId === station.id);
		if (!challenge) throw new Error('missing a challenge!');
		return {
			id: station.id,
			name: station.name,
			latitude: station.latitude,
			longitude: station.longitude,
			mapLabel: station.mapLabel,
			challenge: {
				boardId: challengeRef?.boardId ?? null,
				challengeId: challenge.id,
				stationId: station.id,
				type: challenge.type as ChallengeType,
				currentValue: challenge.currentValue,
				failureCount: challenge.failureCountTotal,
				latitude: challenge.latitude,
				longitude: challenge.longitude,
				isActive: Boolean(challengeRef)
			},
			ownership: stationOwnership.get(station.id) ?? {
				ownerTeamId: null,
				ownerColor: null,
				margin: 0,
				depositsByTeam: {}
			},
			googleMapsUrl: buildGoogleMapsUrl(challenge.latitude, challenge.longitude)
		};
	});

	return {
		session: {
			config,
			rules: config.rules,
			selectedTeamId: raw.selectedTeamId,
			bootstrap,
			currentDay: gameClock.currentDay,
			startTimestamp: gameClock.startTimestamp,
			gameStarted: gameClock.gameStarted
		},
		teams,
		stations
	};
}

export function buildSelectedStation(
	raw: RawState,
	stations: StationSummary[],
	stationId: string
): SelectedStationView | null {
	const station = stations.find((entry) => entry.id === stationId);
	if (!station) return null;
	const teamMap = new Map(raw.teams.map((team) => [team.id, team.name]));
	const boardId = station.challenge?.boardId;
	return {
		...station,
		deposits: raw.deposits
			.filter((deposit) => deposit.stationId === stationId)
			.map((deposit) => ({
				id: deposit.id,
				teamId: deposit.teamId,
				teamName: teamMap.get(deposit.teamId) ?? deposit.teamId,
				amount: deposit.amount,
				createdAt: deposit.createdAt
			})),
		attempts: raw.attempts
			.filter((attempt) =>
				boardId ? attempt.boardId === boardId : attempt.stationId === stationId
			)
			.map((attempt) => ({
				id: attempt.id,
				teamId: attempt.teamId,
				teamName: teamMap.get(attempt.teamId) ?? attempt.teamId,
				outcome: attempt.outcome as 'complete' | 'fail',
				rewardDelta: attempt.rewardDelta,
				quantity: attempt.quantity,
				createdAt: attempt.createdAt
			}))
	};
}

export function buildStationDetailsById(
	raw: RawState,
	stations: StationSummary[]
): Record<string, SelectedStationView> {
	const details: Record<string, SelectedStationView> = {};
	for (const station of stations) {
		const selected = buildSelectedStation(raw, stations, station.id);
		if (selected) {
			details[station.id] = selected;
		}
	}
	return details;
}

export function computeStats(teams: TeamSummary[], stations: StationSummary[]): StatsSummary {
	const teamStats = teams.map((team) => {
		let totalInvestment = 0;
		let wastedChips = 0;
		let extraChips = 0;

		for (const station of stations) {
			const deposits = station.ownership.depositsByTeam;
			const teamDeposit = deposits[team.id] ?? 0;
			if (teamDeposit === 0) continue;
			totalInvestment += teamDeposit;

			if (station.ownership.ownerTeamId !== team.id) {
				wastedChips += teamDeposit;
				continue;
			}

			const competitors = Object.entries(deposits)
				.filter(([teamId]) => teamId !== team.id)
				.map(([, amount]) => amount);
			const secondPlace = competitors.length > 0 ? Math.max(...competitors) : 0;
			const requiredToControl = secondPlace + 1;
			const excessHere = Math.max(0, teamDeposit - requiredToControl);
			extraChips += excessHere;
		}

		return {
			teamId: team.id,
			teamName: team.name,
			teamColor: team.color,
			totalInvestment,
			wastedChips,
			extraChips,
			efficientChips: Math.max(0, totalInvestment - wastedChips - extraChips)
		};
	});

	return {
		totalInvestment: teamStats.reduce((sum, team) => sum + team.totalInvestment, 0),
		teamStats
	};
}
