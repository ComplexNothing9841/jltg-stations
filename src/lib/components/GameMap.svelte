<script lang="ts">
	import type { StyleSpecification } from 'maplibre-gl';
	import { MapLibre, Marker, NavigationControl } from 'svelte-maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import StationMarker from './StationMarker.svelte';
	import type { GameSession, StationSummary } from '$lib/game/types';

	let {
		session = null,
		stations = [],
		selectedStationId = $bindable(null),
		zoom = $bindable(null),
		center = $bindable(null),
		overlayLabel = null
	}: {
		session: GameSession | null;
		stations?: StationSummary[];
		selectedStationId: string | null;
		zoom: number | null;
		center: [number, number] | null;
		overlayLabel?: string | null;
	} = $props();

	let mapConfigKey = $state<string | null>(null);

	const fallbackStyle: StyleSpecification = {
		version: 8,
		sources: {},
		layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#fff5df' } }]
	};

	const mapStyle = $derived(
		(session?.config.map.styleJson as StyleSpecification | undefined) ??
			session?.config.map.styleUrl ??
			fallbackStyle
	);
	const sortedStations = $derived(
		[...stations].sort((left, right) => {
			const leftPriority = left.challenge?.isActive ? 1 : 0;
			const rightPriority = right.challenge?.isActive ? 1 : 0;
			return leftPriority - rightPriority;
		})
	);

	$effect(() => {
		if (!session) {
			center = null;
			zoom = null;
			mapConfigKey = null;
			return;
		}

		const nextKey = `${session.bootstrap?.hash ?? 'no-bootstrap'}:${JSON.stringify(session.config.map.initialView)}:${session.config.map.styleUrl ?? 'inline-style'}`;
		if (mapConfigKey === nextKey) return;

		center = [...session.config.map.initialView.center] as [number, number];
		zoom = session.config.map.initialView.zoom;
		mapConfigKey = nextKey;
	});
</script>

<div class="map-shell">
	{#if session}
		{#if overlayLabel}
			<div class="mobile-day-badge" aria-label={overlayLabel}>{overlayLabel}</div>
		{/if}
		<MapLibre
			style={mapStyle}
			touchPitch={false}
			minPitch={0}
			maxPitch={0}
			pitchWithRotate={false}
			dragRotate={false}
			attributionControl={{
				compact: true
			}}
			center={center ?? session.config.map.initialView.center}
			zoom={zoom ?? session.config.map.initialView.zoom}
			onzoom={(event) => (zoom = event.target.getZoom())}
			onmoveend={(event) => {
				const mapCenter = event.target.getCenter();
				center = [mapCenter.lng, mapCenter.lat];
			}}
			minZoom={session.config.map.initialView.zoom}
			pitch={session.config.map.initialView.pitch}
			bearing={session.config.map.initialView.bearing}
			class="game-map"
			autoloadGlobalCss={false}
			maxBounds={session.config.map.maxBounds
				? [
						[session.config.map.maxBounds.minLat, session.config.map.maxBounds.minLng],
						[session.config.map.maxBounds.maxLat, session.config.map.maxBounds.maxLng]
					]
				: undefined}
		>
			<NavigationControl
				position="top-right"
				showCompass={false}
				visualizePitch={false}
				visualizeRoll={false}
			/>
			{#each sortedStations as station (station.id)}
				<Marker lnglat={[station.longitude, station.latitude]} anchor="center">
					{#snippet content()}
						<button
							class:marker-button-priority={station.challenge?.isActive}
							class="marker-button"
							type="button"
							onclick={() => (selectedStationId = station.id)}
						>
							<StationMarker
								{station}
								zoom={zoom ?? session.config.map.initialView.zoom}
								selected={selectedStationId === station.id}
								dimmed={!!selectedStationId && selectedStationId !== station.id}
							/>
						</button>
					{/snippet}
				</Marker>
			{/each}
		</MapLibre>
	{:else}
		<div class="map-placeholder">Load a config to render the map.</div>
	{/if}
</div>

<style>
	:global {
		.map-shell {
			position: relative;
			flex: 1 1 auto;
			height: 100%;
			min-height: 0;
			overflow: hidden;
			border: 1px solid var(--line);
			border-radius: 28px;
			box-shadow: var(--shadow);
		}

		.game-map,
		.map-placeholder {
			width: 100%;
			height: 100%;
			min-height: 0;
		}

		.map-placeholder {
			display: grid;
			place-items: center;
			background: radial-gradient(circle at top, #ffeebd, #ffd7a0);
		}

		.marker-button {
			position: relative;
			z-index: 1;
			padding: 0;
			cursor: pointer;
			background: transparent;
			border: 0;
		}

		.marker-button-priority {
			z-index: 3;
		}

		.mobile-day-badge {
			position: absolute;
			top: 0.75rem;
			left: 0.75rem;
			z-index: 4;
			padding: 0.35rem 0.65rem;
			border-radius: 999px;
			border: 1px solid var(--line);
			background: color-mix(in srgb, var(--panel) 88%, #ffffff);
			font-weight: 700;
			font-size: 0.82rem;
			box-shadow: var(--shadow);
			pointer-events: none;
		}

		@media (min-width: 1024px) {
			.mobile-day-badge {
				display: none;
			}
		}
	}
</style>
