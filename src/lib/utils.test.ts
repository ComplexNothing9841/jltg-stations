import { describe, it, expect } from 'vitest';
import {
	formatTimestamp,
	getChallengeValue,
	buildGoogleMapsUrl,
	resolveStartTimestamp,
	toEpochMs,
	getMapOverlayLabel
} from './utils';
import type { BoardChallengeView } from './game/types';

describe('formatTimestamp', () => {
	it('formats ISO timestamp correctly', () => {
		const result = formatTimestamp('2026-05-06T12:00:00.000Z');
		expect(result).toContain('May');
		expect(result).toContain('2026');
	});

	it('handles different date formats', () => {
		const result = formatTimestamp('2026-01-01T00:00:00Z');
		expect(result).toBeTruthy();
		expect(typeof result).toBe('string');
	});
});

describe('getChallengeValue', () => {
	it('formats standard challenge', () => {
		const challenge: BoardChallengeView = {
			boardId: 'board1',
			challengeId: 'ch1',
			stationId: 'st1',
			type: 'standard',
			currentValue: 100,
			failureCount: 0,
			latitude: 0,
			longitude: 0,
			isActive: true
		};
		expect(getChallengeValue(challenge)).toBe('100 Chips');
	});

	it('formats steal challenge', () => {
		const challenge: BoardChallengeView = {
			boardId: 'board1',
			challengeId: 'ch1',
			stationId: 'st1',
			type: 'steal',
			currentValue: 50,
			failureCount: 0,
			latitude: 0,
			longitude: 0,
			isActive: true
		};
		expect(getChallengeValue(challenge)).toBe('50% Steal');
	});

	it('formats multiplier challenge', () => {
		const challenge: BoardChallengeView = {
			boardId: 'board1',
			challengeId: 'ch1',
			stationId: 'st1',
			type: 'multiplier',
			currentValue: 25,
			failureCount: 0,
			latitude: 0,
			longitude: 0,
			isActive: true
		};
		expect(getChallengeValue(challenge)).toBe('25% Multiplier');
	});

	it('formats call-your-shot challenge', () => {
		const challenge: BoardChallengeView = {
			boardId: 'board1',
			challengeId: 'ch1',
			stationId: 'st1',
			type: 'call-your-shot',
			currentValue: 10,
			failureCount: 0,
			latitude: 0,
			longitude: 0,
			isActive: true
		};
		expect(getChallengeValue(challenge)).toBe('Call Your Shot');
	});

	it('formats decimal percentages correctly', () => {
		const challenge: BoardChallengeView = {
			boardId: 'board1',
			challengeId: 'ch1',
			stationId: 'st1',
			type: 'steal',
			currentValue: 33.5,
			failureCount: 0,
			latitude: 0,
			longitude: 0,
			isActive: true
		};
		expect(getChallengeValue(challenge)).toBe('33.5% Steal');
	});
});

describe('buildGoogleMapsUrl', () => {
	it('builds correct Google Maps URL', () => {
		const url = buildGoogleMapsUrl(25.0, 121.5);
		expect(url).toContain('https://www.google.com/maps/');
		expect(url).toContain('25');
		expect(url).toContain('121.5');
	});

	it('handles negative coordinates', () => {
		const url = buildGoogleMapsUrl(-25.0, -121.5);
		expect(url).toContain('https://www.google.com/maps/');
		expect(url).toContain('-25');
		expect(url).toContain('-121.5');
	});

	it('encodes coordinates properly', () => {
		const url = buildGoogleMapsUrl(25.123456, 121.789012);
		expect(url).toBeTruthy();
		expect(url).toContain('map_action=map');
	});
});

describe('resolveStartTimestamp', () => {
	it('prefers session value when available', () => {
		const result = resolveStartTimestamp('1000', 2000);
		expect(result).toBe(1000);
	});

	it('falls back to config value when session is null', () => {
		const result = resolveStartTimestamp(null, 2000);
		expect(result).toBe(2000);
	});

	it('falls back to config value when session is empty string', () => {
		const result = resolveStartTimestamp('', 2000);
		expect(result).toBe(2000);
	});

	it('returns null when both are unavailable', () => {
		const result = resolveStartTimestamp(null, undefined);
		expect(result).toBeNull();
	});

	it('returns null when session is invalid and config is undefined', () => {
		const result = resolveStartTimestamp('invalid', undefined);
		expect(result).toBeNull();
	});

	it('handles zero values correctly', () => {
		const result = resolveStartTimestamp('0', 1000);
		expect(result).toBe(0);
	});
});

describe('toEpochMs', () => {
	it('converts seconds to milliseconds', () => {
		expect(toEpochMs(1000000000)).toBe(1000000000000);
	});

	it('leaves milliseconds unchanged', () => {
		expect(toEpochMs(1000000000000)).toBe(1000000000000);
	});

	it('handles threshold boundary (just below threshold converts to ms)', () => {
		expect(toEpochMs(999999999999)).toBe(999999999999000);
	});

	it('handles threshold boundary (milliseconds)', () => {
		expect(toEpochMs(1000000000000)).toBe(1000000000000);
	});

	it('converts recent Unix timestamp in seconds', () => {
		const nowInSeconds = Math.floor(Date.now() / 1000);
		const result = toEpochMs(nowInSeconds);
		expect(result).toBeGreaterThan(1000000000000);
		expect(result).toBe(nowInSeconds * 1000);
	});
});

describe('getMapOverlayLabel', () => {
	describe('when game has started', () => {
		it('shows current day', () => {
			const result = getMapOverlayLabel({
				startTimestamp: 1000,
				gameStarted: true,
				currentDay: 3,
				nowMs: Date.now()
			});
			expect(result).toBe('Day 3');
		});

		it('shows day 1', () => {
			const result = getMapOverlayLabel({
				startTimestamp: 1000,
				gameStarted: true,
				currentDay: 1,
				nowMs: Date.now()
			});
			expect(result).toBe('Day 1');
		});
	});

	describe('when game has not started', () => {
		it('shows "Starts soon" when no timestamp', () => {
			const result = getMapOverlayLabel({
				startTimestamp: null,
				gameStarted: false,
				currentDay: 1,
				nowMs: Date.now()
			});
			expect(result).toBe('Starts soon');
		});

		it('shows minutes when less than 1 hour away', () => {
			const nowMs = Date.now();
			const startInMinutes = nowMs + 30 * 60 * 1000; // 30 minutes
			const result = getMapOverlayLabel({
				startTimestamp: startInMinutes,
				gameStarted: false,
				currentDay: 1,
				nowMs
			});
			expect(result).toBe('Starts in 30m');
		});

		it('shows 1 minute minimum', () => {
			const nowMs = Date.now();
			const startIn30Seconds = nowMs + 30 * 1000; // 30 seconds
			const result = getMapOverlayLabel({
				startTimestamp: startIn30Seconds,
				gameStarted: false,
				currentDay: 1,
				nowMs
			});
			expect(result).toBe('Starts in 1m');
		});

		it('shows hours when same day but >= 1 hour away', () => {
			const now = new Date();
			now.setHours(10, 0, 0, 0);
			const nowMs = now.getTime();
			const start = new Date(now);
			start.setHours(14, 0, 0, 0); // 4 hours later, same day
			const result = getMapOverlayLabel({
				startTimestamp: start.getTime(),
				gameStarted: false,
				currentDay: 1,
				nowMs
			});
			expect(result).toBe('Starts in 4h');
		});

		it('shows days when different day', () => {
			const nowMs = Date.now();
			const startInDays = nowMs + 2 * 24 * 60 * 60 * 1000; // 2 days
			const result = getMapOverlayLabel({
				startTimestamp: startInDays,
				gameStarted: false,
				currentDay: 1,
				nowMs
			});
			expect(result).toBe('Starts in 2d');
		});

		it('shows "Starts soon" when time has passed', () => {
			const nowMs = Date.now();
			const pastStart = nowMs - 1000; // 1 second ago
			const result = getMapOverlayLabel({
				startTimestamp: pastStart,
				gameStarted: false,
				currentDay: 1,
				nowMs
			});
			expect(result).toBe('Starts soon');
		});

		it('handles Unix timestamp in seconds', () => {
			const nowMs = Date.now();
			const startInSeconds = Math.floor(nowMs / 1000) + 3600; // 1 hour from now in seconds

			const result = getMapOverlayLabel({
				startTimestamp: startInSeconds, // in seconds
				gameStarted: false,
				currentDay: 1,
				nowMs
			});

			// Should show time remaining (hours or minutes depending on exact timing)
			expect(result).toMatch(/Starts in \d+[mhd]/);
		});
	});
});
