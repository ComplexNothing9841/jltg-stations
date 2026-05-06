import type { GameConfig } from './schema';

const CONFIG_CACHE_PREFIX = 'tw-stations-config:';
export const BOOTSTRAP_STORAGE_KEY = 'tw-stations:bootstrap';

export type MapDownloadPreset = 'minimal' | 'medium' | 'full';

type TileDownloadSettings = {
	zoomFloor: number;
	wideAreaCeiling: number;
	stationDetailFloor: number;
	stationDetailCeiling: number;
	boundPaddingDegrees: number;
	stationDetailRadius: number;
	includeStationDetail: boolean;
};

const TILE_DOWNLOAD_PRESETS: Record<MapDownloadPreset, TileDownloadSettings> = {
	minimal: {
		zoomFloor: 5,
		wideAreaCeiling: 5,
		stationDetailFloor: 5,
		stationDetailCeiling: 5,
		boundPaddingDegrees: 0.15,
		stationDetailRadius: 1,
		includeStationDetail: false
	},
	medium: {
		zoomFloor: 5,
		wideAreaCeiling: 10,
		stationDetailFloor: 11,
		stationDetailCeiling: 15,
		boundPaddingDegrees: 0.15,
		stationDetailRadius: 1,
		includeStationDetail: true
	},
	full: {
		zoomFloor: 8,
		wideAreaCeiling: 15,
		stationDetailFloor: 9,
		stationDetailCeiling: 13,
		boundPaddingDegrees: 0.3,
		stationDetailRadius: 1.25,
		includeStationDetail: true
	}
};

const GLYPH_RANGES = ['0-255', '256-511', '512-767', '768-1023', '65280-65535'];

type StyleLike = {
	sprite?: string;
	glyphs?: string;
	sources?: Record<string, unknown>;
	layers?: Array<Record<string, unknown>>;
};

type TileSource = {
	url?: string;
	tiles?: string[];
	minzoom?: number;
	maxzoom?: number;
};

export function getConfigCacheName(versionHash: string) {
	return `${CONFIG_CACHE_PREFIX}${versionHash}`;
}

function resolveUrl(url: string, baseUrl: string) {
	return new URL(url, baseUrl).toString().replace(/%7B/gi, '{').replace(/%7D/gi, '}');
}

function getStyleBaseUrl(config: GameConfig) {
	return config.map.styleUrl ?? globalThis.location?.origin ?? 'https://example.com';
}

async function getResolvedStyle(config: GameConfig) {
	const baseUrl = getStyleBaseUrl(config);
	const rawStyle = config.map.styleJson
		? structuredClone(config.map.styleJson)
		: config.map.styleUrl
			? ((await fetch(config.map.styleUrl, { cache: 'no-store' }).then(async (response) => {
					if (!response.ok) throw new Error(`Failed to fetch style JSON: ${config.map.styleUrl}`);
					return response.json();
				})) as StyleLike)
			: ({} as StyleLike);
	const style = rawStyle as StyleLike;
	if (style.sprite) style.sprite = resolveUrl(style.sprite, baseUrl);
	if (style.glyphs) style.glyphs = resolveUrl(style.glyphs, baseUrl);
	for (const source of Object.values(style.sources ?? {})) {
		if (!source || typeof source !== 'object') continue;
		const typedSource = source as TileSource;
		if (typeof typedSource.url === 'string') typedSource.url = resolveUrl(typedSource.url, baseUrl);
		if (Array.isArray(typedSource.tiles)) {
			typedSource.tiles = typedSource.tiles.map((url) => resolveUrl(url, baseUrl));
		}
	}
	return style;
}

function extractBounds(config: GameConfig, settings: TileDownloadSettings) {
	const coordinates = config.stations.map(
		(station) => [station.longitude, station.latitude] as const
	);
	const longitudes = coordinates.map(([longitude]) => longitude);
	const latitudes = coordinates.map(([, latitude]) => latitude);
	return {
		minLongitude: Math.min(...longitudes) - settings.boundPaddingDegrees,
		maxLongitude: Math.max(...longitudes) + settings.boundPaddingDegrees,
		minLatitude: Math.min(...latitudes) - settings.boundPaddingDegrees,
		maxLatitude: Math.max(...latitudes) + settings.boundPaddingDegrees
	};
}

function longitudeToTileX(longitude: number, zoom: number) {
	return Math.floor(((longitude + 180) / 360) * 2 ** zoom);
}

function latitudeToTileY(latitude: number, zoom: number) {
	const radians = (latitude * Math.PI) / 180;
	return Math.floor(
		((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom
	);
}

function buildTileUrlsForTemplate(
	template: string,
	bounds: ReturnType<typeof extractBounds>,
	minZoom: number,
	maxZoom: number
) {
	const urls = new Set<string>();
	for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
		const xStart = longitudeToTileX(bounds.minLongitude, zoom);
		const xEnd = longitudeToTileX(bounds.maxLongitude, zoom);
		const yStart = latitudeToTileY(bounds.maxLatitude, zoom);
		const yEnd = latitudeToTileY(bounds.minLatitude, zoom);
		addTileWindow(urls, template, zoom, xStart, xEnd, yStart, yEnd);
	}
	return [...urls];
}

function addTileWindow(
	urls: Set<string>,
	template: string,
	zoom: number,
	xStart: number,
	xEnd: number,
	yStart: number,
	yEnd: number
) {
	for (let x = xStart; x <= xEnd; x += 1) {
		for (let y = yStart; y <= yEnd; y += 1) {
			urls.add(
				template.replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y))
			);
		}
	}
}

function buildStationDetailTileUrls(
	template: string,
	config: GameConfig,
	minZoom: number,
	maxZoom: number,
	radius: number
) {
	const urls = new Set<string>();
	for (const station of config.stations) {
		for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
			const centerX = longitudeToTileX(station.longitude, zoom);
			const centerY = latitudeToTileY(station.latitude, zoom);
			addTileWindow(
				urls,
				template,
				zoom,
				centerX - radius,
				centerX + radius,
				centerY - radius,
				centerY + radius
			);
		}
	}
	return [...urls];
}

function extractFontStacks(style: StyleLike) {
	const fontStacks = new Set<string>();
	for (const layer of style.layers ?? []) {
		const textFont = (layer.layout as { 'text-font'?: unknown } | undefined)?.['text-font'];
		if (Array.isArray(textFont)) {
			for (const fontName of textFont) {
				if (typeof fontName === 'string') fontStacks.add(fontName);
			}
		}
	}
	if (fontStacks.size === 0) fontStacks.add('Noto Sans Regular');
	return [...fontStacks];
}

function buildGlyphUrls(style: StyleLike) {
	if (!style.glyphs) return [];
	const fonts = extractFontStacks(style);
	const urls = new Set<string>();
	for (const font of fonts) {
		for (const range of GLYPH_RANGES) {
			urls.add(
				style.glyphs.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', range)
			);
		}
	}
	return [...urls];
}

async function resolveSourceTileTemplates(source: TileSource) {
	if (Array.isArray(source.tiles) && source.tiles.length > 0) {
		return {
			tiles: source.tiles,
			minzoom: source.minzoom,
			maxzoom: source.maxzoom
		};
	}
	if (source.url) {
		const response = await fetch(source.url, { cache: 'no-store' });
		if (!response.ok) throw new Error(`Failed to fetch TileJSON: ${source.url}`);
		const tileJson = (await response.json()) as TileSource;
		return {
			tiles: tileJson.tiles ?? [],
			minzoom: tileJson.minzoom ?? source.minzoom,
			maxzoom: tileJson.maxzoom ?? source.maxzoom
		};
	}
	return { tiles: [] };
}

async function buildTileUrls(style: StyleLike, config: GameConfig, preset: MapDownloadPreset) {
	const settings = TILE_DOWNLOAD_PRESETS[preset];
	const bounds = extractBounds(config, settings);
	const urls = new Set<string>();
	for (const source of Object.values(style.sources ?? {})) {
		if (!source || typeof source !== 'object') continue;
		const resolved = await resolveSourceTileTemplates(source as TileSource);
		for (const template of resolved.tiles) {
			if (template.includes('{z}') && template.includes('{x}') && template.includes('{y}')) {
				const areaMinZoom = Math.max(settings.zoomFloor, resolved.minzoom ?? settings.zoomFloor);
				const areaMaxZoom = Math.min(
					settings.wideAreaCeiling,
					resolved.maxzoom ?? settings.wideAreaCeiling
				);
				for (const url of buildTileUrlsForTemplate(template, bounds, areaMinZoom, areaMaxZoom)) {
					urls.add(url);
				}
				if (settings.includeStationDetail) {
					const stationMinZoom = Math.max(
						settings.stationDetailFloor,
						resolved.minzoom ?? settings.stationDetailFloor
					);
					const stationMaxZoom = Math.min(
						settings.stationDetailCeiling,
						resolved.maxzoom ?? settings.stationDetailCeiling
					);
					for (const url of buildStationDetailTileUrls(
						template,
						config,
						stationMinZoom,
						stationMaxZoom,
						settings.stationDetailRadius
					)) {
						urls.add(url);
					}
				}
			} else {
				urls.add(template);
			}
		}
	}
	return [...urls];
}

export async function getOfflineAssetPlan(config: GameConfig, preset: MapDownloadPreset = 'full') {
	const style = await getResolvedStyle(config);
	const urls = new Set<string>();
	const tileUrls = await buildTileUrls(style, config, preset);
	if (config.map.styleUrl) urls.add(config.map.styleUrl);
	if (style.sprite) {
		urls.add(`${style.sprite}.json`);
		urls.add(`${style.sprite}.png`);
	}
	for (const url of buildGlyphUrls(style)) urls.add(url);
	for (const url of tileUrls) urls.add(url);
	return { assetUrls: [...urls], tileUrls };
}

export async function downloadAssets(
	cacheName: string,
	assetUrls: string[],
	onAssetCached?: (url: string) => void
) {
	const cache = await caches.open(cacheName);

	async function runWithLimit<T>(
		items: T[],
		limit: number,
		fn: (item: T) => Promise<void>
	): Promise<void> {
		const executing = new Set<Promise<void>>();

		for (const item of items) {
			const p = fn(item).finally(() => executing.delete(p));
			executing.add(p);

			if (executing.size >= limit) {
				await Promise.race(executing);
			}
		}

		await Promise.all(executing);
	}

	await runWithLimit(assetUrls, 35, async (url) => {
		const response = await fetch(url, { cache: 'no-store' });
		if (!response.ok) throw new Error(`Failed to cache asset: ${url}`);
		await cache.put(url, response.clone());
		onAssetCached?.(url);
	});
}

export async function verifyCachedAssets(cacheName: string, assetUrls: string[]) {
	const cache = await caches.open(cacheName);
	const checks = await Promise.all(assetUrls.map((url) => cache.match(url)));
	return checks.every(Boolean);
}

export async function retireStaleConfigCaches(activeVersionHash: string) {
	for (const cacheName of await caches.keys()) {
		if (
			cacheName.startsWith(CONFIG_CACHE_PREFIX) &&
			cacheName !== getConfigCacheName(activeVersionHash)
		) {
			await caches.delete(cacheName);
		}
	}
}
