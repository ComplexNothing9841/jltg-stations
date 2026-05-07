import type { GameConfig } from '$lib/config/schema';
import { db } from '../index';
import { teams, stations, challenges, stationConnections, configSnapshots } from '../schema';
import { ensureSchema } from '../repository';

export function createMockGameConfig(overrides: Partial<GameConfig> = {}): GameConfig {
	return {
		version: '1.0',
		name: 'Test Game',
		teams: [
			{ id: 'team1', name: 'Team Red', color: '#ff0000' },
			{ id: 'team2', name: 'Team Blue', color: '#0000ff' }
		],
		stations: [
			{
				id: 'station1',
				name: 'Station 1',
				latitude: 25.0,
				longitude: 121.5,
				adjacentStationIds: ['station2'],
				challenge: {
					id: 'challenge1',
					type: 'standard',
					baseValue: 100,
					latitude: 25.0,
					longitude: 121.5
				}
			},
			{
				id: 'station2',
				name: 'Station 2',
				latitude: 25.1,
				longitude: 121.6,
				adjacentStationIds: ['station1'],
				challenge: {
					id: 'challenge2',
					type: 'steal',
					baseValue: 50,
					latitude: 25.1,
					longitude: 121.6
				}
			},
			{
				id: 'station3',
				name: 'Station 3',
				latitude: 25.2,
				longitude: 121.7,
				adjacentStationIds: [],
				challenge: {
					id: 'challenge3',
					type: 'multiplier',
					baseValue: 25,
					latitude: 25.2,
					longitude: 121.7
				}
			}
		],
		rules: {
			initialBoardSize: 2,
			refillSize: 1,
			boardMax: 3,
			failureBoostPercent: 10,
			dayCount: 3,
			dayMultipliers: [1, 1.5, 2],
			maxChipLead: 100,
			startingChipBalance: 500
		},
		map: {
			styleUrl: 'https://example.com/style.json',
			initialView: {
				center: [121.5, 25.0],
				zoom: 11,
				pitch: 0,
				bearing: 0
			}
		},
		...overrides
	};
}

export async function seedTestGame(config: GameConfig = createMockGameConfig()) {
	await ensureSchema();

	// Insert config snapshot
	await db.insert(configSnapshots).values({
		id: 'test-config',
		configUrl: 'test://config.json',
		version: config.version,
		hash: 'test-hash',
		json: JSON.stringify(config),
		createdAt: new Date().toISOString(),
		isActive: true
	});

	// Insert teams
	for (const [index, team] of config.teams.entries()) {
		await db.insert(teams).values({
			id: team.id,
			name: team.name,
			color: team.color,
			sortOrder: index
		});
	}

	// Insert stations and challenges
	for (const station of config.stations) {
		await db.insert(stations).values({
			id: station.id,
			name: station.name,
			latitude: station.latitude,
			longitude: station.longitude,
			mapLabel: station.mapLabel ?? null
		});

		await db.insert(challenges).values({
			id: station.challenge.id,
			stationId: station.id,
			type: station.challenge.type,
			baseValue: station.challenge.baseValue,
			currentValue: station.challenge.baseValue,
			latitude: station.challenge.latitude ?? station.latitude,
			longitude: station.challenge.longitude ?? station.longitude,
			failureCountTotal: 0
		});

		// Insert station connections
		for (const adjacentId of station.adjacentStationIds ?? []) {
			await db.insert(stationConnections).values({
				id: crypto.randomUUID(),
				fromStationId: station.id,
				toStationId: adjacentId
			});
		}
	}

	return config;
}
