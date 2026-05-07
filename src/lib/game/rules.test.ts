import { describe, it, expect } from 'vitest';
import {
	computeChallengeReward,
	applyFailureBoost,
	computeStationOwnership,
	validateDeposit,
	getDayMultiplier
} from './rules';
import type { GameplayRules } from '$lib/config/schema';

describe('computeChallengeReward', () => {
	describe('standard challenges', () => {
		it('calculates basic reward with multiplier', () => {
			const reward = computeChallengeReward({
				type: 'standard',
				currentValue: 100,
				dayMultiplier: 1.5
			});
			expect(reward).toBe(150);
		});

		it('rounds to nearest integer', () => {
			const reward = computeChallengeReward({
				type: 'standard',
				currentValue: 100,
				dayMultiplier: 1.33
			});
			expect(reward).toBe(133);
		});

		it('handles zero value', () => {
			const reward = computeChallengeReward({
				type: 'standard',
				currentValue: 0,
				dayMultiplier: 2
			});
			expect(reward).toBe(0);
		});

		it('handles multiplier of 1', () => {
			const reward = computeChallengeReward({
				type: 'standard',
				currentValue: 100,
				dayMultiplier: 1
			});
			expect(reward).toBe(100);
		});

		it('handles large values', () => {
			const reward = computeChallengeReward({
				type: 'standard',
				currentValue: 10000,
				dayMultiplier: 2.5
			});
			expect(reward).toBe(25000);
		});
	});

	describe('steal challenges', () => {
		it('calculates steal percentage with day multiplier', () => {
			const reward = computeChallengeReward({
				type: 'steal',
				currentValue: 50,
				dayMultiplier: 2
			});
			expect(reward).toBe(100);
		});

		it('rounds to nearest integer', () => {
			const reward = computeChallengeReward({
				type: 'steal',
				currentValue: 33,
				dayMultiplier: 1.5
			});
			expect(reward).toBe(50);
		});

		it('handles zero value', () => {
			const reward = computeChallengeReward({
				type: 'steal',
				currentValue: 0,
				dayMultiplier: 1.5
			});
			expect(reward).toBe(0);
		});
	});

	describe('multiplier challenges', () => {
		it('applies percentage to current balance', () => {
			const reward = computeChallengeReward({
				type: 'multiplier',
				currentValue: 25,
				dayMultiplier: 2,
				currentBalance: 1000
			});
			expect(reward).toBe(500);
		});

		it('handles zero balance', () => {
			const reward = computeChallengeReward({
				type: 'multiplier',
				currentValue: 50,
				dayMultiplier: 1,
				currentBalance: 0
			});
			expect(reward).toBe(0);
		});

		it('handles negative balance (treats as zero)', () => {
			const reward = computeChallengeReward({
				type: 'multiplier',
				currentValue: 50,
				dayMultiplier: 1,
				currentBalance: -100
			});
			expect(reward).toBe(0);
		});

		it('handles undefined balance (treats as zero)', () => {
			const reward = computeChallengeReward({
				type: 'multiplier',
				currentValue: 50,
				dayMultiplier: 1
			});
			expect(reward).toBe(0);
		});

		it('rounds to nearest integer', () => {
			const reward = computeChallengeReward({
				type: 'multiplier',
				currentValue: 33,
				dayMultiplier: 1.5,
				currentBalance: 100
			});
			expect(reward).toBe(50);
		});

		it('handles 100% multiplier (doubles balance)', () => {
			const reward = computeChallengeReward({
				type: 'multiplier',
				currentValue: 100,
				dayMultiplier: 1,
				currentBalance: 500
			});
			expect(reward).toBe(500);
		});
	});

	describe('call-your-shot challenges', () => {
		it('multiplies value by quantity and day multiplier', () => {
			const reward = computeChallengeReward({
				type: 'call-your-shot',
				currentValue: 10,
				quantity: 5,
				dayMultiplier: 2
			});
			expect(reward).toBe(100);
		});

		it('returns 0 when quantity is null', () => {
			const reward = computeChallengeReward({
				type: 'call-your-shot',
				currentValue: 10,
				quantity: null,
				dayMultiplier: 1
			});
			expect(reward).toBe(0);
		});

		it('returns 0 when quantity is undefined', () => {
			const reward = computeChallengeReward({
				type: 'call-your-shot',
				currentValue: 10,
				dayMultiplier: 1
			});
			expect(reward).toBe(0);
		});

		it('handles quantity of zero', () => {
			const reward = computeChallengeReward({
				type: 'call-your-shot',
				currentValue: 10,
				quantity: 0,
				dayMultiplier: 1
			});
			expect(reward).toBe(0);
		});

		it('handles quantity of one', () => {
			const reward = computeChallengeReward({
				type: 'call-your-shot',
				currentValue: 50,
				quantity: 1,
				dayMultiplier: 1
			});
			expect(reward).toBe(50);
		});

		it('rounds to nearest integer', () => {
			const reward = computeChallengeReward({
				type: 'call-your-shot',
				currentValue: 10,
				quantity: 3,
				dayMultiplier: 1.5
			});
			expect(reward).toBe(45);
		});

		it('handles large quantities', () => {
			const reward = computeChallengeReward({
				type: 'call-your-shot',
				currentValue: 10,
				quantity: 100,
				dayMultiplier: 1
			});
			expect(reward).toBe(1000);
		});
	});
});

describe('applyFailureBoost', () => {
	it('applies boost percentage correctly', () => {
		const result = applyFailureBoost(100, 10);
		expect(result).toBe(111); // Math.ceil rounds up
	});

	it('rounds up to nearest integer', () => {
		const result = applyFailureBoost(100, 15);
		expect(result).toBe(115);
	});

	it('rounds up fractional results', () => {
		const result = applyFailureBoost(10, 5);
		expect(result).toBe(11);
	});

	it('handles zero boost percentage', () => {
		const result = applyFailureBoost(100, 0);
		expect(result).toBe(100);
	});

	it('handles large boost percentages', () => {
		const result = applyFailureBoost(100, 50);
		expect(result).toBe(150);
	});

	it('handles zero value', () => {
		const result = applyFailureBoost(0, 10);
		expect(result).toBe(0);
	});

	it('applies boost cumulatively', () => {
		let value = 100;
		value = applyFailureBoost(value, 10); // 111 (Math.ceil(100 * 1.1))
		value = applyFailureBoost(value, 10); // 123 (Math.ceil(111 * 1.1))
		expect(value).toBe(123);
	});
});

describe('computeStationOwnership', () => {
	it('returns null owner when no deposits', () => {
		const ownership = computeStationOwnership({});
		expect(ownership).toEqual({
			ownerTeamId: null,
			ownerColor: null,
			margin: 0,
			depositsByTeam: {}
		});
	});

	it('returns null owner when all deposits are zero', () => {
		const ownership = computeStationOwnership({
			team1: 0,
			team2: 0
		});
		expect(ownership).toEqual({
			ownerTeamId: null,
			ownerColor: null,
			margin: 0,
			depositsByTeam: { team1: 0, team2: 0 }
		});
	});

	it('identifies single team as owner', () => {
		const ownership = computeStationOwnership({
			team1: 100
		});
		expect(ownership.ownerTeamId).toBe('team1');
		expect(ownership.ownerColor).toBeNull();
		expect(ownership.margin).toBe(100);
	});

	it('calculates margin between first and second place', () => {
		const ownership = computeStationOwnership({
			team1: 150,
			team2: 100,
			team3: 50
		});
		expect(ownership.ownerTeamId).toBe('team1');
		expect(ownership.margin).toBe(50);
		expect(ownership.depositsByTeam).toEqual({
			team1: 150,
			team2: 100,
			team3: 50
		});
	});

	it('handles tie scenario (margin is zero)', () => {
		const ownership = computeStationOwnership({
			team1: 100,
			team2: 100
		});
		expect(ownership.ownerTeamId).toBeTruthy();
		expect(['team1', 'team2']).toContain(ownership.ownerTeamId);
		expect(ownership.margin).toBe(0);
	});

	it('sorts teams by deposit amount descending', () => {
		const ownership = computeStationOwnership({
			team1: 50,
			team2: 200,
			team3: 100
		});
		expect(ownership.ownerTeamId).toBe('team2');
		expect(ownership.margin).toBe(100); // 200 - 100
	});

	it('handles large deposit values', () => {
		const ownership = computeStationOwnership({
			team1: 10000,
			team2: 5000
		});
		expect(ownership.ownerTeamId).toBe('team1');
		expect(ownership.margin).toBe(5000);
	});

	it('preserves deposit data in result', () => {
		const deposits = {
			team1: 150,
			team2: 100,
			team3: 50
		};
		const ownership = computeStationOwnership(deposits);
		expect(ownership.depositsByTeam).toEqual(deposits);
		// Note: The implementation returns the same reference, not a copy
	});
});

describe('validateDeposit', () => {
	it('allows deposit within max chip lead', () => {
		const ownership = computeStationOwnership({
			team1: 150,
			team2: 100
		});

		const result = validateDeposit({
			ownership,
			teamId: 'team1',
			amount: 50,
			maxChipLead: 100
		});

		expect(result.ownerTeamId).toBe('team1');
		expect(result.margin).toBe(100); // 200 - 100
	});

	it('throws when deposit would exceed max lead', () => {
		const ownership = computeStationOwnership({
			team1: 150,
			team2: 100
		});

		expect(() => {
			validateDeposit({
				ownership,
				teamId: 'team1',
				amount: 51,
				maxChipLead: 100
			});
		}).toThrow('exceed max lead');
	});

	it('allows deposit at exact max lead threshold', () => {
		const ownership = computeStationOwnership({
			team1: 100,
			team2: 50
		});

		const result = validateDeposit({
			ownership,
			teamId: 'team1',
			amount: 50,
			maxChipLead: 100
		});

		expect(result.margin).toBe(100);
	});

	it('allows deposit by non-owner team', () => {
		const ownership = computeStationOwnership({
			team1: 150,
			team2: 100
		});

		const result = validateDeposit({
			ownership,
			teamId: 'team2',
			amount: 100,
			maxChipLead: 100
		});

		expect(result.ownerTeamId).toBe('team2');
		expect(result.margin).toBe(50); // 200 - 150
	});

	it('allows new team to deposit', () => {
		const ownership = computeStationOwnership({
			team1: 100
		});

		const result = validateDeposit({
			ownership,
			teamId: 'team2',
			amount: 50,
			maxChipLead: 100
		});

		expect(result.ownerTeamId).toBe('team1');
		expect(result.margin).toBe(50); // 100 - 50
	});

	it('throws when new deposit creates excessive lead', () => {
		const ownership = computeStationOwnership({
			team1: 50
		});

		expect(() => {
			validateDeposit({
				ownership,
				teamId: 'team2',
				amount: 200,
				maxChipLead: 100
			});
		}).toThrow('exceed max lead');
	});

	it('allows first deposit at any station', () => {
		const ownership = computeStationOwnership({});

		const result = validateDeposit({
			ownership,
			teamId: 'team1',
			amount: 50,
			maxChipLead: 100
		});

		expect(result.ownerTeamId).toBe('team1');
		expect(result.margin).toBe(50);
	});
});

describe('getDayMultiplier', () => {
	const rules: GameplayRules = {
		initialBoardSize: 3,
		refillSize: 1,
		boardMax: 5,
		failureBoostPercent: 10,
		dayCount: 3,
		dayMultipliers: [1, 1.5, 2],
		maxChipLead: 100,
		startingChipBalance: 500
	};

	it('returns correct multiplier for day 1', () => {
		expect(getDayMultiplier(rules, 1)).toBe(1);
	});

	it('returns correct multiplier for day 2', () => {
		expect(getDayMultiplier(rules, 2)).toBe(1.5);
	});

	it('returns correct multiplier for day 3', () => {
		expect(getDayMultiplier(rules, 3)).toBe(2);
	});

	it('clamps to first multiplier for day 0', () => {
		expect(getDayMultiplier(rules, 0)).toBe(1);
	});

	it('clamps to last multiplier for day beyond dayCount', () => {
		expect(getDayMultiplier(rules, 10)).toBe(2);
	});

	it('returns 1 for empty multipliers array', () => {
		const emptyRules = { ...rules, dayMultipliers: [] };
		expect(getDayMultiplier(emptyRules, 1)).toBe(1);
	});
});
