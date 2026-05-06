import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const configSnapshots = sqliteTable('config_snapshot', {
	id: text('id').primaryKey(),
	configUrl: text('config_url').notNull(),
	version: text('version').notNull(),
	hash: text('hash').notNull(),
	json: text('json').notNull(),
	createdAt: text('created_at').notNull(),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true)
});

export const sessionSettings = sqliteTable('session_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: text('updated_at').notNull()
});

export const teams = sqliteTable('team', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	color: text('color').notNull(),
	sortOrder: integer('sort_order').notNull()
});

export const stations = sqliteTable('station', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	latitude: real('latitude').notNull(),
	longitude: real('longitude').notNull(),
	mapLabel: text('map_label')
});

export const stationConnections = sqliteTable('station_connection', {
	id: text('id').primaryKey(),
	fromStationId: text('from_station_id').notNull(),
	toStationId: text('to_station_id').notNull()
});

export const challenges = sqliteTable('challenge', {
	id: text('id').primaryKey(),
	stationId: text('station_id').notNull(),
	type: text('type').notNull(),
	baseValue: integer('base_value').notNull(),
	currentValue: integer('current_value').notNull(),
	latitude: real('latitude').notNull(),
	longitude: real('longitude').notNull(),
	failureCountTotal: integer('failure_count_total').notNull().default(0)
});

export const boardChallenges = sqliteTable('board_challenge', {
	id: text('id').primaryKey(),
	challengeId: text('challenge_id').notNull(),
	status: text('status').notNull(),
	slotOrder: integer('slot_order').notNull(),
	activatedAt: text('activated_at').notNull(),
	resolvedAt: text('resolved_at')
});

export const stationDeposits = sqliteTable('station_deposit', {
	id: text('id').primaryKey(),
	stationId: text('station_id').notNull(),
	teamId: text('team_id').notNull(),
	amount: integer('amount').notNull(),
	createdAt: text('created_at').notNull(),
	actionId: text('action_id').notNull()
});

export const challengeAttempts = sqliteTable('challenge_attempt', {
	id: text('id').primaryKey(),
	boardId: text('board_id').notNull(),
	challengeId: text('challenge_id').notNull(),
	stationId: text('station_id').notNull(),
	teamId: text('team_id').notNull(),
	outcome: text('outcome').notNull(),
	quantity: integer('quantity'),
	rewardDelta: integer('reward_delta').notNull().default(0),
	createdAt: text('created_at').notNull(),
	actionId: text('action_id').notNull()
});

export const actionLog = sqliteTable('action_log', {
	id: text('id').primaryKey(),
	kind: text('kind').notNull(),
	payload: text('payload').notNull(),
	createdAt: text('created_at').notNull()
});
