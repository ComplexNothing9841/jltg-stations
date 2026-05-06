import {
	computeChallengeReward,
	applyFailureBoost,
	getDayMultiplier,
	validateDeposit
} from './rules';
import { buildSelectedStation, projectGameState } from './project';
import {
	activateBoardChallenge,
	appendActionLog,
	createChallengeAttempt,
	createDeposit,
	getRawState,
	resolveBoard,
	updateChallengeProgress
} from '$lib/db/repository';
import type { ActionSummary } from './types';
import { resolveStartTimestamp } from '$lib/utils.js';

function assertGameStarted(raw: Awaited<ReturnType<typeof getRawState>>) {
	const startTimestamp = resolveStartTimestamp(raw.gameStartTimestamp, raw.config?.startTimestamp);
	if (!startTimestamp) return;
	if (Date.now() < startTimestamp * 1000) {
		throw new Error('Game has not started yet');
	}
}

function randomize<T>(values: T[]) {
	const shuffled = [...values];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}
	return shuffled;
}

async function refillBoard(
	rawParam?: Awaited<ReturnType<typeof getRawState>>,
	preferredChallengeIds: string[] = []
) {
	const raw = rawParam ?? (await getRawState());
	if (!raw.config) return [] as string[];
	const active = raw.boardChallenges.filter((entry) => entry.status === 'active');
	if (active.length >= raw.config.rules.boardMax) return [];
	const activeChallengeIds = new Set(active.map((entry) => entry.challengeId));
	let available = raw.challenges.filter((challenge) => !activeChallengeIds.has(challenge.id));
	if (available.length === 0) available = raw.challenges;
	const availableMap = new Map(available.map((challenge) => [challenge.id, challenge]));
	const targetCount = Math.min(
		raw.config.rules.boardMax,
		active.length + raw.config.rules.refillSize
	);
	const countNeeded = Math.max(0, targetCount - active.length);
	const activatedIds: string[] = [];
	const chosenIds = preferredChallengeIds
		.filter((id) => availableMap.has(id))
		.slice(0, countNeeded);
	for (const challengeId of chosenIds) {
		await activateBoardChallenge(challengeId, active.length + activatedIds.length);
		activatedIds.push(challengeId);
		availableMap.delete(challengeId);
	}
	if (activatedIds.length < countNeeded) {
		const remaining = randomize([...availableMap.values()]).slice(
			0,
			countNeeded - activatedIds.length
		);
		for (const challenge of remaining) {
			await activateBoardChallenge(challenge.id, active.length + activatedIds.length);
			activatedIds.push(challenge.id);
		}
	}
	return activatedIds;
}

export async function initializeStartingBoard(inputChallengeIds?: string[]) {
	const raw = await getRawState();
	if (!raw.config) throw new Error('No game config is loaded');
	if (raw.boardChallenges.length > 0) return [] as string[];
	const allChallengeIds = raw.challenges.map((challenge) => challenge.id);
	const initialBoardSize = raw.config.rules.initialBoardSize;
	const preferredChallengeIds =
		inputChallengeIds && inputChallengeIds.length > 0
			? inputChallengeIds
			: (raw.config.startingChallengeIds ?? []);
	if (preferredChallengeIds.length > 0) {
		const uniqueIds = [...new Set(preferredChallengeIds)];
		if (uniqueIds.length !== initialBoardSize) {
			throw new Error(`Expected exactly ${initialBoardSize} starting challenge IDs`);
		}
		for (const challengeId of uniqueIds) {
			if (!allChallengeIds.includes(challengeId)) {
				throw new Error(`Unknown challenge ID: ${challengeId}`);
			}
		}
		for (const [index, challengeId] of uniqueIds.entries()) {
			await activateBoardChallenge(challengeId, index);
		}
		return uniqueIds;
	}
	const generated = randomize(allChallengeIds).slice(0, initialBoardSize);
	for (const [index, challengeId] of generated.entries()) {
		await activateBoardChallenge(challengeId, index);
	}
	return generated;
}

async function persistAction(summary: ActionSummary) {
	await appendActionLog(summary);
}

async function getProjectedState() {
	const raw = await getRawState();
	if (!raw.config) throw new Error('No game config is loaded');
	assertGameStarted(raw);
	return { raw: { ...raw, config: raw.config }, projected: projectGameState(raw, null) };
}

async function createAttempt(args: {
	boardId: string;
	challengeId: string;
	stationId: string;
	teamId: string;
	outcome: 'complete' | 'fail';
	quantity: number | null;
	rewardDelta: number;
	actionId: string;
	createdAt: string;
}) {
	await createChallengeAttempt({
		id: crypto.randomUUID(),
		...args
	});
}

async function getChallengeContext(challengeId: string) {
	const raw = await getRawState();
	if (!raw.config) throw new Error('No game config is loaded');
	assertGameStarted(raw);
	const challenge = raw.challenges.find((entry) => entry.id === challengeId);
	if (!challenge) throw new Error('Challenge not found');
	return { raw: { ...raw, config: raw.config }, challenge };
}

export async function depositAtStation(args: {
	teamId: string;
	stationId: string;
	amount: number;
}) {
	const { raw, projected } = await getProjectedState();
	const config = raw.config;
	const station = buildSelectedStation(raw, projected.stations, args.stationId);
	if (!station) throw new Error('Station not found');
	// if (!config) throw new Error('No config!');
	validateDeposit({
		ownership: station.ownership,
		teamId: args.teamId,
		amount: args.amount,
		maxChipLead: config.rules.maxChipLead
	});
	const team = projected.teams.find((entry) => entry.id === args.teamId);
	if (!team) throw new Error('Team not found');
	if (team.balance < args.amount) throw new Error('Not enough chips to deposit');
	const createdAt = new Date().toISOString();
	await createDeposit({
		id: crypto.randomUUID(),
		stationId: args.stationId,
		teamId: args.teamId,
		amount: args.amount,
		actionId: crypto.randomUUID(),
		createdAt
	});
	const summary: ActionSummary = {
		kind: 'deposit',
		teamId: args.teamId,
		stationId: args.stationId,
		amount: args.amount,
		spawnedChallengeIds: []
	};
	await persistAction(summary);
	return summary;
}

export async function doDebt(args: {
	teamId: string;
	toTeamId: string;
	stationId: string;
	amount: number;
}) {
	const { raw, projected } = await getProjectedState();

	if (args.teamId === args.toTeamId) throw new Error('Debt transfer requires two different teams');
	if (!Number.isInteger(args.amount) || args.amount <= 0)
		throw new Error('Debt amount must be positive');

	const station = buildSelectedStation(raw, projected.stations, args.stationId);
	if (!station) throw new Error('Station not found');
	if (station.ownership.ownerTeamId !== args.toTeamId) {
		throw new Error('Debt recipient must be the station owner');
	}
	if ((station.ownership.margin ?? 0) !== args.amount) {
		throw new Error('Debt amount must match station ownership margin');
	}

	const team = projected.teams.find((entry) => entry.id === args.teamId);
	if (!team) throw new Error('Debtor team not found');
	const toTeam = projected.teams.find((entry) => entry.id === args.toTeamId);
	if (!toTeam) throw new Error('Recipient team not found');

	const giveSummary: ActionSummary = {
		kind: 'giveDebt',
		teamId: args.teamId,
		stationId: args.stationId,
		amount: args.amount,
		spawnedChallengeIds: []
	};
	await persistAction(giveSummary);

	const receiveSummary: ActionSummary = {
		kind: 'receiveDebt',
		teamId: args.toTeamId,
		stationId: args.stationId,
		amount: args.amount,
		spawnedChallengeIds: []
	};
	await persistAction(receiveSummary);
	return { giveSummary, receiveSummary };
}

export async function completeBoardChallenge(args: {
	teamId: string;
	stationId: string;
	challengeId: string;
	boardId: string;
	quantity?: number | null;
	spawnedChallengeIds?: string[];
}) {
	const { raw, challenge } = await getChallengeContext(args.challengeId);
	const projected = projectGameState(raw, null);
	const currentDay = projected.session?.currentDay ?? 1;
	const activeTeam = projected.teams.find((entry) => entry.id === args.teamId);
	if (!activeTeam) throw new Error('Team not found');
	const config = raw.config;
	let rewardDelta = computeChallengeReward({
		type: challenge.type as never,
		currentValue: challenge.currentValue,
		quantity: args.quantity,
		dayMultiplier: getDayMultiplier(config.rules, currentDay),
		currentBalance: activeTeam.balance
	});
	if (challenge.type === 'call-your-shot' && !args.quantity) {
		throw new Error('Call-your-shot requires a quantity');
	}
	let stealVictimTeamId: string | null = null;
	if (challenge.type === 'steal') {
		const station = buildSelectedStation(raw, projected.stations, args.stationId);
		const stationOwnerTeamId = station?.ownership.ownerTeamId ?? null;
		const preferredVictimTeamId =
			stationOwnerTeamId && stationOwnerTeamId !== args.teamId ? stationOwnerTeamId : null;
		const fallbackVictimTeamId = projected.teams
			.filter((team) => team.id !== args.teamId)
			.sort((left, right) => right.balance - left.balance)[0]?.id;
		const victimTeamId = preferredVictimTeamId ?? fallbackVictimTeamId ?? null;
		const victimTeam = victimTeamId
			? (projected.teams.find((team) => team.id === victimTeamId) ?? null)
			: null;
		const availableToSteal = Math.max(0, victimTeam?.balance ?? 0);
		rewardDelta = Math.min(
			Math.floor(
				availableToSteal *
					(challenge.currentValue / 100) *
					getDayMultiplier(config.rules, currentDay)
			),
			availableToSteal
		);
		stealVictimTeamId = rewardDelta > 0 ? victimTeamId : null;
	}
	const createdAt = new Date().toISOString();
	const actionId = crypto.randomUUID();
	await createAttempt({
		boardId: args.boardId,
		challengeId: args.challengeId,
		stationId: args.stationId,
		teamId: args.teamId,
		outcome: 'complete',
		quantity: args.quantity ?? null,
		rewardDelta,
		actionId,
		createdAt
	});
	if (stealVictimTeamId && rewardDelta > 0) {
		await createAttempt({
			boardId: args.boardId,
			challengeId: args.challengeId,
			stationId: args.stationId,
			teamId: stealVictimTeamId,
			outcome: 'complete',
			quantity: null,
			rewardDelta: -rewardDelta,
			actionId,
			createdAt
		});
	}
	await resolveBoard(args.boardId, 'completed');
	await updateChallengeProgress(args.challengeId, challenge.baseValue, challenge.failureCountTotal);
	const spawnedChallengeIds = await refillBoard(undefined, args.spawnedChallengeIds ?? []);
	const summary: ActionSummary = {
		kind: 'complete',
		teamId: args.teamId,
		stationId: args.stationId,
		challengeId: args.challengeId,
		quantity: args.quantity ?? null,
		spawnedChallengeIds
	};
	await persistAction(summary);
	return summary;
}

export async function failBoardChallenge(args: {
	teamId: string;
	stationId: string;
	challengeId: string;
	boardId: string;
	spawnedChallengeIds?: string[];
}) {
	const { raw, challenge } = await getChallengeContext(args.challengeId);
	if (!raw.config) throw new Error('Missing config!');
	const createdAt = new Date().toISOString();
	await createAttempt({
		boardId: args.boardId,
		challengeId: args.challengeId,
		stationId: args.stationId,
		teamId: args.teamId,
		outcome: 'fail',
		quantity: null,
		rewardDelta: 0,
		actionId: crypto.randomUUID(),
		createdAt
	});
	await updateChallengeProgress(
		args.challengeId,
		applyFailureBoost(challenge.currentValue, raw.config.rules.failureBoostPercent),
		challenge.failureCountTotal + 1
	);
	const updated = await getRawState();
	const failedTeamIds = new Set(
		updated.attempts
			.filter((attempt) => attempt.boardId === args.boardId && attempt.outcome === 'fail')
			.map((attempt) => attempt.teamId)
	);
	let spawnedChallengeIds: string[] = [];
	if (failedTeamIds.size >= updated.teams.length) {
		await resolveBoard(args.boardId, 'failed_out');
		spawnedChallengeIds = await refillBoard(undefined, args.spawnedChallengeIds ?? []);
	}
	const summary: ActionSummary = {
		kind: 'fail',
		teamId: args.teamId,
		stationId: args.stationId,
		challengeId: args.challengeId,
		spawnedChallengeIds
	};
	await persistAction(summary);
	return summary;
}

export async function replicateManualAction(input: ActionSummary) {
	if (input.kind === 'deposit') {
		if (!input.stationId || !input.amount)
			throw new Error('Deposit requires station ID and chip amount');
		return depositAtStation({
			teamId: input.teamId,
			stationId: input.stationId,
			amount: input.amount
		});
	}
	if (input.kind === 'giveDebt') {
		if (!input.stationId) throw new Error('Debt requires station ID');
		const raw = await getRawState();
		const projected = projectGameState(raw, null);
		const station = buildSelectedStation(raw, projected.stations, input.stationId);
		if (!station) throw new Error('Station not found');
		const ownerTeamId = station.ownership.ownerTeamId;
		const margin = station.ownership.margin ?? 0;
		if (!ownerTeamId) throw new Error('Station has no owner');
		if (ownerTeamId === input.teamId) throw new Error('Debt transfer requires two different teams');
		if (!Number.isInteger(margin) || margin <= 0) {
			throw new Error('Station margin must be positive to replicate debt');
		}
		return doDebt({
			teamId: input.teamId,
			toTeamId: ownerTeamId,
			stationId: input.stationId,
			amount: margin
		});
	}
	if (input.kind === 'receiveDebt') {
		throw new Error('Use "Give Debt" to replicate debt; receive debt is generated automatically');
	}

	const raw = await getRawState();
	const challenge = raw.challenges.find((entry) => entry.id === input.challengeId);
	if (!challenge) throw new Error('Challenge ID not found');
	const board = raw.boardChallenges.find(
		(entry) => entry.challengeId === challenge.id && entry.status === 'active'
	);
	if (!board) throw new Error('Challenge is not currently on the board');

	if (input.kind === 'complete') {
		return completeBoardChallenge({
			teamId: input.teamId,
			stationId: challenge.stationId,
			challengeId: challenge.id,
			boardId: board.id,
			quantity: input.quantity,
			spawnedChallengeIds: input.spawnedChallengeIds ?? []
		});
	}

	return failBoardChallenge({
		teamId: input.teamId,
		stationId: challenge.stationId,
		challengeId: challenge.id,
		boardId: board.id,
		spawnedChallengeIds: input.spawnedChallengeIds ?? []
	});
}
