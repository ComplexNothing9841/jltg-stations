<script lang="ts">
	import type { StationSummary } from '$lib/game/types';

	let {
		station,
		zoom = 7,
		selected,
		dimmed
	}: { station: StationSummary; zoom?: number; selected: boolean; dimmed: boolean } = $props();

	const activeChallenge = $derived(station.challenge?.isActive ? station.challenge : null);
	const isClaimed = $derived(Boolean(station.ownership.ownerColor));
	const zoomProgress = $derived.by(() => {
		const minZoom = 8;
		const maxZoom = 14;
		return Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
	});
	const markerScale = $derived.by(() => {
		return ((0.34 + zoomProgress * 1.46) * (selected ? 1.3 : 1)).toFixed(3);
	});
	const coreSize = $derived.by(() => {
		return `${(18 + zoomProgress * 10).toFixed(2)}px`;
	});
	const dotSize = $derived.by(() => {
		const base = isClaimed ? 18 : 10;
		const delta = isClaimed ? 10 : 8;
		return `${(base + zoomProgress * delta).toFixed(2)}px`;
	});
	const challengeScale = $derived.by(() => {
		return (2 - zoomProgress * 1.1).toFixed(3);
	});
	const haloOpacity = $derived.by(() => {
		return (0.28 + zoomProgress * 0.32).toFixed(3);
	});
	const showChallengeValue = $derived(zoom >= 10.5);
	const showLabel = $derived(zoom >= 11.5);
	const challengeTone = $derived(
		activeChallenge
			? {
					standard: { bg: '#fff8dc', fg: '#4a3413', border: '#f1b94f' },
					multiplier: { bg: '#0d5bd7', fg: '#f8fbff', border: '#8bc1ff' },
					steal: { bg: '#1a1736', fg: '#f6f2ff', border: '#8d7bff' },
					'call-your-shot': { bg: '#114538', fg: '#ecfff8', border: '#69d8b0' }
				}[activeChallenge.type]
			: null
	);
	const challengeGlyph = $derived(
		activeChallenge
			? {
					standard: '+',
					multiplier: 'x',
					steal: '!',
					'call-your-shot': '?'
				}[activeChallenge.type]
			: null
	);
	const challengeLabel = $derived(
		activeChallenge
			? activeChallenge.type === 'multiplier'
				? `${activeChallenge.currentValue}%`
				: activeChallenge.type === 'standard'
					? `${activeChallenge.currentValue}`
					: activeChallenge.type === 'steal'
						? 'Steal'
						: 'Call'
			: ''
	);
	const stationLabel = $derived.by(() => {
		const label = (station.mapLabel ?? station.name).trim();
		return label.length > 10 ? `${label.slice(0, 8).trim()}..` : label;
	});
</script>

<div
	class="marker"
	class:selected
	class:dimmed
	title={station.name}
	style:--marker-scale={markerScale}
	style:--core-size={coreSize}
	style:--dot-size={dotSize}
	style:--challenge-scale={challengeScale}
	style:--halo-opacity={haloOpacity}
	style:--owner-color={station.ownership.ownerColor ?? '#d5dae0'}
	style:--highlight-color={station.ownership.ownerColor ?? 'var(--accent)'}
>
	<div class="core">
		{#if !isClaimed}
			<div class="halo"></div>
		{/if}

		<div class:ring={!isClaimed} class:fill={isClaimed}>
			<div class="dot"></div>
		</div>

		{#if activeChallenge && challengeTone && challengeGlyph}
			<div
				class="badge"
				style:--challenge-bg={challengeTone.bg}
				style:--challenge-fg={challengeTone.fg}
				style:--challenge-border={challengeTone.border}
			>
				<span class="glyph">{challengeGlyph}</span>
				{#if showChallengeValue}
					<span class="value">{challengeLabel}</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if showLabel}
		<div class="label">{stationLabel}</div>
	{/if}
</div>

<style>
	.marker {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		transform: scale(var(--marker-scale));
		transform-origin: center;
		transition: transform 0.08s ease-out;
	}

	.marker.dimmed {
		filter: brightness(0.85);
	}

	.marker.selected .core::after {
		content: '';
		position: absolute;
		inset: -0.5rem;
		border-radius: 999px;
		border: 2px solid var(--highlight-color);
		opacity: 0.9;
		animation: pulse 1.4s ease-out infinite;
		pointer-events: none;
	}

	@keyframes pulse {
		0% {
			transform: scale(0.9);
			opacity: 0.9;
		}
		70% {
			transform: scale(1.6);
			opacity: 0;
		}
		100% {
			opacity: 0;
		}
	}

	.marker.selected .fill,
	.marker.selected .ring {
		box-shadow:
			0 0 0 3px color-mix(in srgb, var(--owner-color) 60%, white),
			0 0 18px color-mix(in srgb, var(--owner-color) 70%, transparent),
			0 8px 22px rgba(15, 23, 42, 0.45);
	}

	.marker.selected .label {
		border-color: color-mix(in srgb, var(--owner-color) 60%, white);
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--owner-color) 40%, white),
			0 8px 22px rgba(15, 23, 42, 0.25);
		font-weight: 800;
	}

	.core {
		position: relative;
		display: grid;
		place-items: center;
		width: var(--core-size);
		height: var(--core-size);
	}

	.halo,
	.ring,
	.fill,
	.dot {
		border-radius: 999px;
	}

	.halo {
		position: absolute;
		inset: -0.22rem;
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--owner-color) 42%, white) 0%,
			transparent 72%
		);
		opacity: var(--halo-opacity);
	}

	.ring,
	.fill {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
	}

	.ring {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(237, 242, 247, 0.92));
		border: 2px solid rgb(25 35 57 / 0.82);
		box-shadow:
			0 5px 15px rgba(15, 23, 42, 0.26),
			0 0 0 2px rgba(255, 255, 255, 0.72);
	}

	.fill {
		background: var(--owner-color);
		box-shadow: 0 5px 15px rgba(15, 23, 42, 0.22);
	}

	.dot {
		width: var(--dot-size);
		height: var(--dot-size);
		background: var(--owner-color);
		box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35);
	}

	.fill .dot {
		width: 100%;
		height: 100%;
		box-shadow: none;
	}

	.badge {
		position: absolute;
		left: calc(100% - 0.3rem);
		top: -0.75rem;
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		min-height: 1.15rem;
		padding: 0.18rem 0.38rem 0.18rem 0.33rem;
		border: 2px solid var(--challenge-border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--challenge-bg) 92%, white);
		box-shadow:
			0 10px 18px rgba(15, 23, 42, 0.2),
			0 0 0 2px rgba(255, 255, 255, 0.82);
		color: var(--challenge-fg);
		white-space: nowrap;
		transform: scale(var(--challenge-scale));
		transform-origin: left center;
	}

	.glyph {
		display: inline-grid;
		place-items: center;
		width: 0.75rem;
		font-size: 0.73rem;
		font-weight: 900;
		line-height: 1;
		text-transform: uppercase;
	}

	.value {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.01em;
		line-height: 1;
	}

	.label {
		margin: -0.7rem;
		max-width: 9.5rem;
		padding: 0.22rem 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.45);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 6px 18px rgba(15, 23, 42, 0.14);
		color: #102033;
		font-size: 0.6rem;
		font-weight: 700;
		line-height: 1;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		backdrop-filter: blur(10px);
	}
</style>
