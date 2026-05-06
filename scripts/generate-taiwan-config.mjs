import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATION_URL =
	'https://ods.railway.gov.tw/tra-ods-web/ods/download/dataResource/0518b833e8964d53bfea3f7691aea0ee';
const LINE_MILEAGE_URL =
	'https://ods.railway.gov.tw/tra-ods-web/ods/download/dataResource/f0906cb8dcee4dfd9eb5f8a9a2bd0f5a';
const STYLE_URL = 'https://jltg-stations.pages.dev/osmTheme.json';
const DEFAULT_OUTPUT = 'static/taiwan.json';
const EXCLUDED_STATION_CODES = new Set(['1998']); // 1998 has no gps value for some reason
const CHALLENGE_TYPES = [
	'standard',
	'standard',
	'standard',
	'standard',
	'standard',
	'steal',
	'multiplier',
	'call-your-shot',
	'call-your-shot'
]; // (weighted)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

async function fetchJson(url) {
	const response = await fetch(url, { headers: { accept: 'application/json' } });
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

async function readTemplateConfig(outputPath) {
	try {
		return JSON.parse(await readFile(outputPath, 'utf8'));
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

function parseGps(value, stationCode) {
	const [latRaw, lonRaw] = String(value ?? '')
		.trim()
		.split(/\s+/);
	const latitude = Number(latRaw);
	const longitude = Number(lonRaw);
	if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		throw new Error(`Station ${stationCode} has invalid gps value: ${value}`);
	}
	return { latitude, longitude };
}

function compareMileage(a, b) {
	return Number(a.staMil) - Number(b.staMil);
}

function buildAdjacency(lineMileageRows, includedCodes) {
	const grouped = new Map();
	for (const row of lineMileageRows) {
		if (!grouped.has(row.lineName)) grouped.set(row.lineName, []);
		grouped.get(row.lineName).push(row);
	}

	const adjacency = new Map();
	for (const stationCode of includedCodes) adjacency.set(stationCode, new Set());

	for (const rows of grouped.values()) {
		const orderedCodes = rows
			.sort(compareMileage)
			.map((row) => row.fkSta)
			.filter((stationCode) => includedCodes.has(stationCode))
			.filter((stationCode, index, values) => index === 0 || values[index - 1] !== stationCode);

		for (let index = 1; index < orderedCodes.length; index += 1) {
			const previous = orderedCodes[index - 1];
			const current = orderedCodes[index];
			adjacency.get(previous)?.add(current);
			adjacency.get(current)?.add(previous);
		}
	}

	return adjacency;
}

function buildChallenge(station, index, existingChallenge, defaultChallengeByType) {
	const type = existingChallenge?.type ?? CHALLENGE_TYPES[index % CHALLENGE_TYPES.length];
	const defaults = defaultChallengeByType.get(type) ?? {};
	return {
		id: existingChallenge?.id ?? `C${station.id}`,
		type,
		baseValue: existingChallenge?.baseValue ?? defaults.baseValue ?? 100,
		latitude: station.latitude,
		longitude: station.longitude
	};
}

async function buildMap(templateMap) {
	return {
		styleUrl: STYLE_URL,
		initialView: templateMap?.initialView ?? {
			center: [121.0, 23.7],
			zoom: 7.3,
			pitch: 0,
			bearing: 0
		},
		maxBounds: {
			minLat: 119.8,
			maxLat: 122.35,
			minLng: 21.7,
			maxLng: 25.5
		}
	};
}

function buildConfig(stations, adjacency, templateConfig, mapConfig) {
	const existingStations = new Map(
		(templateConfig?.stations ?? []).map((station) => [station.id, station])
	);
	const defaultChallengeByType = new Map(
		(templateConfig?.stations ?? [])
			.map((station) => station.challenge)
			.filter(Boolean)
			.map((challenge) => [challenge.type, challenge])
	);
	const stationConfigs = stations.map((station, index) => ({
		id: station.stationCode,
		name:
			existingStations.get(station.stationCode)?.name ??
			station.stationEName ??
			station.ename ??
			station.stationName,
		latitude: station.latitude,
		longitude: station.longitude,
		adjacentStationIds: [...(adjacency.get(station.stationCode) ?? new Set())].sort(),
		challenge: buildChallenge(
			{
				id: station.stationCode,
				name:
					existingStations.get(station.stationCode)?.name ??
					station.stationEName ??
					station.ename ??
					station.stationName,
				latitude: station.latitude,
				longitude: station.longitude
			},
			index,
			existingStations.get(station.stationCode)?.challenge,
			defaultChallengeByType
		)
	}));

	return {
		version: templateConfig?.version ?? `taiwan-${new Date().toISOString().slice(0, 10)}`,
		name: templateConfig?.name ?? 'Jet Lag: Taiwan',
		startTimestamp: templateConfig?.startTimestamp,
		teams: templateConfig?.teams ?? [
			{ id: 'blue', name: 'Blue Team', color: '#005f73' },
			{ id: 'orange', name: 'Orange Team', color: '#ca6702' },
			{ id: 'red', name: 'Red Team', color: '#ae2012' },
			{ id: 'green', name: 'Green Team', color: '#3a5a40' }
		],
		stations: stationConfigs,
		rules: templateConfig?.rules ?? {
			initialBoardSize: 12,
			refillSize: 4,
			boardMax: 20,
			failureBoostPercent: 25,
			dayCount: 4,
			dayMultipliers: [1, 1.15, 1.3, 1.5],
			maxChipLead: 500,
			startingChipBalance: 1000
		},
		map: mapConfig
	};
}

async function main() {
	const outputPath = path.resolve(repoRoot, DEFAULT_OUTPUT);
	const templateConfig = await readTemplateConfig(outputPath);
	const [stationRows, lineMileageRows] = await Promise.all([
		fetchJson(STATION_URL),
		fetchJson(LINE_MILEAGE_URL)
	]);

	const stations = stationRows
		.filter((station) => !EXCLUDED_STATION_CODES.has(station.stationCode))
		.map((station) => ({
			...station,
			...parseGps(station.gps, station.stationCode)
		}))
		.sort((a, b) => Number(a.stationCode) - Number(b.stationCode));

	const includedCodes = new Set(stations.map((station) => station.stationCode));
	const adjacency = buildAdjacency(lineMileageRows, includedCodes);
	const mapConfig = await buildMap(templateConfig?.map);
	const config = buildConfig(stations, adjacency, templateConfig, mapConfig);

	const isolatedStations = config.stations.filter(
		(station) => station.adjacentStationIds.length === 0
	);
	if (isolatedStations.length > 0) {
		throw new Error(
			`Found isolated stations with no adjacency: ${isolatedStations.map((station) => station.id).join(', ')}`
		);
	}

	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

	const edgeCount =
		config.stations.reduce((total, station) => total + station.adjacentStationIds.length, 0) / 2;
	console.log(
		JSON.stringify(
			{
				outputPath,
				stationCount: config.stations.length,
				edgeCount,
				challengeTypes: [...new Set(config.stations.map((station) => station.challenge.type))],
				map: {
					styleUrl: config.map.styleUrl
				}
			},
			null,
			2
		)
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
});
