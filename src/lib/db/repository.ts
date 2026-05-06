import { desc, eq } from 'drizzle-orm';
import { db, sql } from './index';
import {
	actionLog,
	boardChallenges,
	challengeAttempts,
	challenges,
	configSnapshots,
	sessionSettings,
	stationConnections,
	stationDeposits,
	stations,
	teams
} from './schema';
import type { GameConfig } from '$lib/config/schema';
import type { ActionSummary, BootstrapMetadata } from '$lib/game/types';

const now = () => new Date().toISOString();

export async function ensureSchema() {
	await sql`CREATE TABLE IF NOT EXISTS config_snapshot (id TEXT PRIMARY KEY NOT NULL, config_url TEXT NOT NULL, version TEXT NOT NULL, hash TEXT NOT NULL, json TEXT NOT NULL, created_at TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1)`;
	await sql`CREATE TABLE IF NOT EXISTS session_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL)`;
	await sql`CREATE TABLE IF NOT EXISTS team (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, sort_order INTEGER NOT NULL)`;
	await sql`CREATE TABLE IF NOT EXISTS station (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, map_label TEXT)`;
	await sql`CREATE TABLE IF NOT EXISTS station_connection (id TEXT PRIMARY KEY NOT NULL, from_station_id TEXT NOT NULL, to_station_id TEXT NOT NULL)`;
	await sql`CREATE TABLE IF NOT EXISTS challenge (id TEXT PRIMARY KEY NOT NULL, station_id TEXT NOT NULL, type TEXT NOT NULL, base_value INTEGER NOT NULL, current_value INTEGER NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, failure_count_total INTEGER NOT NULL DEFAULT 0)`;
	await sql`CREATE TABLE IF NOT EXISTS board_challenge (id TEXT PRIMARY KEY NOT NULL, challenge_id TEXT NOT NULL, status TEXT NOT NULL, slot_order INTEGER NOT NULL, activated_at TEXT NOT NULL, resolved_at TEXT)`;
	await sql`CREATE TABLE IF NOT EXISTS station_deposit (id TEXT PRIMARY KEY NOT NULL, station_id TEXT NOT NULL, team_id TEXT NOT NULL, amount INTEGER NOT NULL, created_at TEXT NOT NULL, action_id TEXT NOT NULL)`;
	await sql`CREATE TABLE IF NOT EXISTS challenge_attempt (id TEXT PRIMARY KEY NOT NULL, board_id TEXT NOT NULL, challenge_id TEXT NOT NULL, station_id TEXT NOT NULL, team_id TEXT NOT NULL, outcome TEXT NOT NULL, quantity INTEGER, reward_delta INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, action_id TEXT NOT NULL)`;
	await sql`CREATE TABLE IF NOT EXISTS action_log (id TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)`;
}

export async function setSessionSetting(key: string, value: string) {
	await ensureSchema();
	await db
		.insert(sessionSettings)
		.values({ key, value, updatedAt: now() })
		.onConflictDoUpdate({
			target: sessionSettings.key,
			set: { value, updatedAt: now() }
		});
}

async function getSessionSetting(key: string) {
	await ensureSchema();
	const row = await db.query.sessionSettings.findFirst({ where: eq(sessionSettings.key, key) });
	return row?.value ?? null;
}

export async function saveConfigSnapshot(metadata: BootstrapMetadata, config: GameConfig) {
	await ensureSchema();
	await db.update(configSnapshots).set({ isActive: false });
	await db
		.insert(configSnapshots)
		.values({
			id: metadata.hash,
			configUrl: metadata.configUrl,
			version: metadata.version,
			hash: metadata.hash,
			json: JSON.stringify(config),
			createdAt: metadata.completedAt,
			isActive: true
		})
		.onConflictDoUpdate({
			target: configSnapshots.id,
			set: {
				configUrl: metadata.configUrl,
				version: metadata.version,
				hash: metadata.hash,
				json: JSON.stringify(config),
				createdAt: metadata.completedAt,
				isActive: true
			}
		});
}

async function getActiveConfig() {
	await ensureSchema();
	const row = await db.query.configSnapshots.findFirst({
		where: eq(configSnapshots.isActive, true)
	});
	try {
		return row ? (JSON.parse(row.json) as GameConfig) : null;
	} catch {
		return null;
	}
}

export async function clearGameTables() {
	await ensureSchema();
	await db.delete(actionLog);
	await db.delete(challengeAttempts);
	await db.delete(stationDeposits);
	await db.delete(boardChallenges);
	await db.delete(challenges);
	await db.delete(stationConnections);
	await db.delete(stations);
	await db.delete(teams);
}

export async function clearAllTables() {
	await ensureSchema();
	await clearGameTables();
	await db.delete(sessionSettings);
	await db.delete(configSnapshots);
}

export async function getRawState() {
	await ensureSchema();
	const [
		activeConfig,
		teamsRows,
		stationRows,
		connectionRows,
		challengeRows,
		boardRows,
		depositRows,
		attemptRows,
		actionRows
	] = await Promise.all([
		getActiveConfig(),
		db.select().from(teams).orderBy(teams.sortOrder),
		db.select().from(stations),
		db.select().from(stationConnections),
		db.select().from(challenges),
		db.select().from(boardChallenges).orderBy(boardChallenges.slotOrder),
		db.select().from(stationDeposits).orderBy(desc(stationDeposits.createdAt)),
		db.select().from(challengeAttempts).orderBy(desc(challengeAttempts.createdAt)),
		db.select().from(actionLog).orderBy(desc(actionLog.createdAt))
	]);
	return {
		config: activeConfig,
		teams: teamsRows,
		stations: stationRows,
		connections: connectionRows,
		challenges: challengeRows,
		boardChallenges: boardRows,
		deposits: depositRows,
		attempts: attemptRows,
		actions: actionRows,
		selectedTeamId: await getSessionSetting('selectedTeamId'),
		gameStartTimestamp: await getSessionSetting('gameStartTimestamp')
	};
}

export async function setSelectedTeamId(teamId: string) {
	await setSessionSetting('selectedTeamId', teamId);
}

export async function setGameStartTimestamp(startTimestamp: number | null) {
	await setSessionSetting(
		'gameStartTimestamp',
		startTimestamp === null ? '' : String(startTimestamp)
	);
}

export async function appendActionLog(summary: ActionSummary) {
	await ensureSchema();
	await db.insert(actionLog).values({
		id: crypto.randomUUID(),
		kind: summary.kind,
		payload: JSON.stringify(summary),
		createdAt: now()
	});
}

export async function createDeposit(args: {
	id: string;
	stationId: string;
	teamId: string;
	amount: number;
	actionId: string;
	createdAt: string;
}) {
	await db.insert(stationDeposits).values(args);
}

export async function createChallengeAttempt(args: {
	id: string;
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
	await db.insert(challengeAttempts).values(args);
}

export async function updateChallengeProgress(
	challengeId: string,
	currentValue: number,
	failureCountTotal: number
) {
	await db
		.update(challenges)
		.set({ currentValue, failureCountTotal })
		.where(eq(challenges.id, challengeId));
}

export async function resolveBoard(boardId: string, status: 'completed' | 'failed_out') {
	await db
		.update(boardChallenges)
		.set({ status, resolvedAt: now() })
		.where(eq(boardChallenges.id, boardId));
}

export async function activateBoardChallenge(challengeId: string, slotOrder: number) {
	await db.insert(boardChallenges).values({
		id: crypto.randomUUID(),
		challengeId,
		status: 'active',
		slotOrder,
		activatedAt: now(),
		resolvedAt: null
	});
}
