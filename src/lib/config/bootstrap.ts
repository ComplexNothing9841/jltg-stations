import { gameConfigSchema, type GameConfig } from './schema';
import {
	BOOTSTRAP_STORAGE_KEY,
	downloadAssets,
	getConfigCacheName,
	getOfflineAssetPlan,
	type MapDownloadPreset,
	retireStaleConfigCaches,
	verifyCachedAssets
} from './assets';
import { saveConfigSnapshot, setSessionSetting } from '$lib/db/repository';
import type { BootstrapMetadata } from '$lib/game/types';

async function sha256(input: string) {
	const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function fetchAndValidateConfig(configUrl: string) {
	const response = await fetch(configUrl, { cache: 'no-store' });
	if (!response.ok) throw new Error(`Config request failed with ${response.status}`);
	const json = (await response.json()) as unknown;
	return gameConfigSchema.parse(json);
}

export async function bootstrapConfig(
	configUrl: string,
	mapDownloadPreset: MapDownloadPreset = 'full',
	onTileCached?: (progress: { cachedCount: number; totalCount: number }) => void
) {
	const config = await fetchAndValidateConfig(configUrl);
	const serialized = JSON.stringify(config);
	const hash = await sha256(serialized);
	const { assetUrls: cachedAssetUrls, tileUrls } = await getOfflineAssetPlan(
		config,
		mapDownloadPreset
	);
	const tileUrlSet = new Set(tileUrls);
	let cachedTileCount = 0;
	onTileCached?.({ cachedCount: 0, totalCount: tileUrls.length });
	const cacheName = getConfigCacheName(hash);
	await downloadAssets(cacheName, cachedAssetUrls, (url) => {
		if (!tileUrlSet.has(url)) return;
		cachedTileCount += 1;
		onTileCached?.({ cachedCount: cachedTileCount, totalCount: tileUrls.length });
	});
	const assetsReady = await verifyCachedAssets(cacheName, cachedAssetUrls);
	if (!assetsReady) throw new Error('Not all map assets could be cached');
	await retireStaleConfigCaches(hash);
	const metadata: BootstrapMetadata = {
		configUrl,
		version: config.version,
		hash,
		cachedAssetUrls,
		completedAt: new Date().toISOString()
	};
	localStorage.setItem(BOOTSTRAP_STORAGE_KEY, JSON.stringify(metadata));
	await saveConfigSnapshot(metadata, config);
	await setSessionSetting('configUrl', configUrl);
	return { config, metadata };
}

export function readBootstrapMetadata() {
	try {
		const raw = localStorage.getItem(BOOTSTRAP_STORAGE_KEY);
		return raw ? (JSON.parse(raw) as BootstrapMetadata) : null;
	} catch {
		return null;
	}
}

export async function getOfflineBootstrapState(
	config: GameConfig,
	metadata: BootstrapMetadata | null
) {
	if (!metadata) {
		return {
			shellReady: true,
			configReady: false,
			assetsReady: false,
			message: 'Config not downloaded yet.'
		};
	}
	const assetsReady = await verifyCachedAssets(
		getConfigCacheName(metadata.hash),
		metadata.cachedAssetUrls
	);
	return {
		shellReady: true,
		configReady: true,
		assetsReady,
		lastSyncAt: metadata.completedAt,
		message: assetsReady
			? `${config.name} is ready offline.`
			: 'Config exists but some assets are missing.'
	};
}
