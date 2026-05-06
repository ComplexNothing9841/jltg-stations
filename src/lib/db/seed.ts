import type { GameConfig } from '$lib/config/schema';
import { db } from './index';
import { clearGameTables, ensureSchema, setGameStartTimestamp } from './repository';
import { challenges, stationConnections, stations, teams } from './schema';

export async function seedConfig(config: GameConfig) {
	await ensureSchema();
	await clearGameTables();

	await db.insert(teams).values(
		config.teams.map((team, index) => ({
			id: team.id,
			name: team.name,
			color: team.color,
			sortOrder: index
		}))
	);

	await db.insert(stations).values(
		config.stations.map((station) => ({
			id: station.id,
			name: station.name,
			latitude: station.latitude,
			longitude: station.longitude,
			mapLabel: station.mapLabel ?? null
		}))
	);

	const edges = new Map<string, { id: string; fromStationId: string; toStationId: string }>();
	for (const station of config.stations) {
		for (const adjacentStationId of station.adjacentStationIds) {
			const [fromStationId, toStationId] = [station.id, adjacentStationId].sort();
			edges.set(`${fromStationId}:${toStationId}`, {
				id: `${fromStationId}:${toStationId}`,
				fromStationId,
				toStationId
			});
		}
	}
	if (edges.size > 0) {
		await db.insert(stationConnections).values([...edges.values()]);
	}

	const challengeRows = config.stations
		.filter((station) => station.challenge)
		.map((station) => ({
			id: station.challenge.id,
			stationId: station.id,
			type: station.challenge.type,
			baseValue: station.challenge.baseValue,
			currentValue: station.challenge.baseValue,
			latitude: station.challenge.latitude ?? station.latitude,
			longitude: station.challenge.longitude ?? station.longitude,
			failureCountTotal: 0
		}));
	if (challengeRows.length > 0) {
		await db.insert(challenges).values(challengeRows);
	}

	await setGameStartTimestamp(config.startTimestamp ?? null);
}
