import {
	bootstrapConfig,
	getOfflineBootstrapState,
	readBootstrapMetadata
} from '$lib/config/bootstrap';
import { BOOTSTRAP_STORAGE_KEY } from '$lib/config/assets';
import type { MapDownloadPreset } from '$lib/config/assets';
import { seedConfig } from '$lib/db/seed';
import {
	clearAllTables,
	getRawState,
	setGameStartTimestamp,
	setSelectedTeamId
} from '$lib/db/repository';
import {
	completeBoardChallenge,
	depositAtStation,
	doDebt,
	failBoardChallenge,
	initializeStartingBoard,
	replicateManualAction
} from '$lib/game/actions';
import { buildStationDetailsById, computeStats, projectGameState } from '$lib/game/project';
import type { ActionSummary, GameViewModel } from '$lib/game/types';

const initialState: GameViewModel = {
	ready: false,
	loading: true,
	setupRequired: true,
	error: null,
	session: null,
	teams: [],
	stations: [],
	stationDetailsById: {},
	connections: [],
	offlineStatus: {
		shellReady: true,
		configReady: false,
		assetsReady: false,
		message: 'Loading local data...'
	},
	stats: null
};
export const game: GameViewModel = $state(initialState);

const selectedTeam = $derived.by(() => {
	const selectedTeamId = game.session?.selectedTeamId;
	if (!selectedTeamId) return null;
	return game.teams.find((team) => team.id === selectedTeamId) ?? null;
});

async function refreshCore() {
	const raw = await getRawState();
	const bootstrap = typeof localStorage === 'undefined' ? null : readBootstrapMetadata();
	const projected = projectGameState(raw, bootstrap);
	const stationDetailsById = buildStationDetailsById(raw, projected.stations);
	const offlineStatus = raw.config
		? await getOfflineBootstrapState(raw.config, bootstrap)
		: {
				shellReady: true,
				configReady: false,
				assetsReady: false,
				message: 'No config downloaded yet.'
			};
	const stats = projected.session ? computeStats(projected.teams, projected.stations) : null;
	const boardInitialized = raw.boardChallenges.length > 0;

	game.ready = true;
	game.loading = false;
	game.setupRequired = !raw.config || !raw.selectedTeamId || !boardInitialized;
	game.error = null;
	game.session = projected.session;
	game.teams = projected.teams;
	game.stations = projected.stations;
	game.stationDetailsById = stationDetailsById;
	game.connections = raw.connections;
	game.offlineStatus = offlineStatus;
	game.stats = stats;
}

export async function refreshGame() {
	try {
		await refreshCore();
	} catch (error) {
		game.error = error instanceof Error ? error.message : 'Failed to refresh app state.';
	}
}

export async function initGame() {
	game.loading = true;
	game.error = null;
	try {
		await refreshCore();
	} catch (error) {
		game.loading = false;
		game.ready = true;
		game.error = error instanceof Error ? error.message : 'Failed to load app.';
	}
}

export async function setupGame(
	configUrl: string,
	selectedTeamId: string,
	startMode?: 'generate' | 'input',
	startingChallengeIds?: string[],
	startTimestamp?: number | null,
	mapDownloadPreset: MapDownloadPreset = 'full',
	onTileCached?: (progress: { cachedCount: number; totalCount: number }) => void
) {
	game.loading = true;
	game.error = null;
	try {
		if (configUrl) {
			const { config } = await bootstrapConfig(configUrl, mapDownloadPreset, onTileCached);
			await seedConfig(config);
		}
		if (selectedTeamId) {
			await setSelectedTeamId(selectedTeamId);
		}
		if (startTimestamp !== undefined) {
			if (startTimestamp !== null && !Number.isFinite(startTimestamp)) {
				throw new Error('Start timestamp must be a valid Unix timestamp');
			}
			await setGameStartTimestamp(startTimestamp);
		}
		let generatedIds: string[] | null = null;
		const raw = await getRawState();
		const shouldInitializeFromConfig =
			!startMode &&
			Boolean(raw.config?.startingChallengeIds?.length) &&
			raw.boardChallenges.length === 0;
		if (startMode || shouldInitializeFromConfig) {
			const ids = await initializeStartingBoard(
				startMode === 'input' ? (startingChallengeIds ?? []) : undefined
			);
			generatedIds = startMode === 'generate' ? ids : null;
		}
		await refreshCore();
		return generatedIds;
	} catch (error) {
		game.loading = false;
		game.error = error instanceof Error ? error.message : 'Setup failed.';
		return null;
	}
}

export async function depositStation(stationId: string | null, amount: number) {
	if (!selectedTeam || !stationId || amount < 1 || !game.session?.gameStarted) return null;
	const summary = await depositAtStation({
		teamId: selectedTeam.id,
		stationId,
		amount
	});
	await refreshCore();
	return summary;
}

export async function debtStation(
	toTeamId: string | null,
	stationId: string | null,
	amount: number
) {
	if (!selectedTeam || !stationId || !game.session?.gameStarted || !toTeamId) return null;

	const result = await doDebt({ teamId: selectedTeam.id, toTeamId, stationId, amount });
	await refreshCore();
	return result;
}

export async function completeChallenge(
	stationId: string,
	challengeId: string,
	quantity?: number | null
) {
	const station = game.stations.find((s) => s.id === stationId);
	if (
		!selectedTeam ||
		!station ||
		!station.challenge.isActive ||
		!station.challenge.boardId ||
		!game.session?.selectedTeamId ||
		!game.session.gameStarted
	)
		return null;

	const summary = await completeBoardChallenge({
		teamId: selectedTeam.id,
		stationId,
		challengeId,
		boardId: station.challenge.boardId,
		quantity
	});
	await refreshCore();
	return summary;
}

export async function failChallenge(stationId: string, challengeId: string) {
	const station = game.stations.find((s) => s.id === stationId);
	if (
		!selectedTeam ||
		!station ||
		!station.challenge.isActive ||
		!station.challenge.boardId ||
		!game.session?.selectedTeamId ||
		!game.session.gameStarted
	)
		return null;

	const summary = await failBoardChallenge({
		teamId: selectedTeam.id,
		stationId,
		challengeId,
		boardId: station.challenge.boardId
	});
	await refreshCore();
	return summary;
}

export async function replicateManual(input: ActionSummary) {
	const summary = await replicateManualAction(input);
	await refreshCore();
	return summary;
}

export async function resetAllData() {
	game.loading = true;
	game.error = null;
	try {
		await clearAllTables();
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(BOOTSTRAP_STORAGE_KEY);
		}
		if (typeof caches !== 'undefined') {
			const keys = await caches.keys();
			await Promise.all(keys.map((key) => caches.delete(key)));
		}
		await refreshCore();
	} catch (error) {
		game.loading = false;
		game.error = error instanceof Error ? error.message : 'Failed to reset app data.';
	}
}
