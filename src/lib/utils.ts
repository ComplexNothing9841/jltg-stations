import type { BoardChallengeView } from '$lib/game/types.js';

function formatPercent(value: number) {
	return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function formatTimestamp(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(value));
}

export function getChallengeValue(challenge: BoardChallengeView) {
	switch (challenge.type) {
		case 'call-your-shot':
			return 'Call Your Shot';
		case 'steal':
			return `${formatPercent(challenge.currentValue)} Steal`;
		case 'multiplier':
			return `${formatPercent(challenge.currentValue)} Multiplier`;
		case 'standard':
			return `${challenge.currentValue} Chips`;
	}
}

export function buildGoogleMapsUrl(latitude: number, longitude: number) {
	return `https://www.google.com/maps/@?api=1&map_action=map&center=${encodeURIComponent(`${latitude},${longitude}`)}`;
}
export function resolveStartTimestamp(
	startFromSessionRaw: string | null,
	startFromConfig?: number
) {
	const startFromSession = startFromSessionRaw ? Number(startFromSessionRaw) : NaN;
	return Number.isFinite(startFromSession)
		? startFromSession
		: Number.isFinite(startFromConfig)
			? startFromConfig
			: null;
}

export function toEpochMs(timestamp: number) {
	return timestamp >= 1_000_000_000_000 ? timestamp : timestamp * 1000;
}

export function getMapOverlayLabel(args: {
	startTimestamp: number | null;
	gameStarted: boolean;
	currentDay: number;
	nowMs: number;
}) {
	if (args.gameStarted) return `Day ${args.currentDay}`;
	if (!args.startTimestamp) return 'Starts soon';

	const startMs = toEpochMs(args.startTimestamp);
	const start = new Date(startMs);
	const now = new Date(args.nowMs);
	const isSameDay =
		start.getFullYear() === now.getFullYear() &&
		start.getMonth() === now.getMonth() &&
		start.getDate() === now.getDate();
	const remainingMs = start.getTime() - now.getTime();
	if (remainingMs <= 0) return 'Starts soon';
	if (remainingMs < 60 * 60 * 1000) {
		const minutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
		return `Starts in ${minutes}m`;
	}
	if (isSameDay) {
		const hours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
		return `Starts in ${hours}h`;
	}
	const dayMs = 24 * 60 * 60 * 1000;
	const days = Math.max(1, Math.ceil(remainingMs / dayMs));
	return `Starts in ${days}d`;
}