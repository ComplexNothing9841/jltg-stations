import type { ChallengeType, GameplayRules } from '$lib/config/schema';
import type { StationOwnership } from './types';

export function getDayMultiplier(rules: GameplayRules, day: number) {
	return rules.dayMultipliers[Math.max(0, Math.min(day - 1, rules.dayMultipliers.length - 1))] ?? 1;
}

export function computeChallengeReward(args: {
	type: ChallengeType;
	currentValue: number;
	quantity?: number | null;
	dayMultiplier: number;
	currentBalance?: number;
}) {
	const { type, currentValue, quantity, dayMultiplier, currentBalance } = args;
	if (type === 'call-your-shot') {
		if (!quantity) return 0;
		return Math.round(currentValue * quantity * dayMultiplier);
	}
	if (type === 'multiplier') {
		const balance = Math.max(0, currentBalance ?? 0);
		return Math.round(balance * (currentValue / 100) * dayMultiplier);
	}
	if (type === 'steal') return Math.round(currentValue * dayMultiplier);
	return Math.round(currentValue * dayMultiplier);
}

export function applyFailureBoost(currentValue: number, failureBoostPercent: number) {
	return Math.ceil(currentValue * (1 + failureBoostPercent / 100));
}

export function computeStationOwnership(depositsByTeam: Record<string, number>): StationOwnership {
	const entries = Object.entries(depositsByTeam).sort((a, b) => b[1] - a[1]);
	if (entries.length === 0 || entries[0][1] === 0) {
		return { ownerTeamId: null, ownerColor: null, margin: 0, depositsByTeam };
	}
	const [ownerTeamId, top] = entries[0];
	const second = entries[1]?.[1] ?? 0;
	return {
		ownerTeamId,
		ownerColor: null,
		margin: top - second,
		depositsByTeam
	};
}

export function validateDeposit(args: {
	ownership: StationOwnership;
	teamId: string;
	amount: number;
	maxChipLead: number;
}) {
	const { ownership, teamId, amount, maxChipLead } = args;
	const deposits = { ...ownership.depositsByTeam };
	deposits[teamId] = (deposits[teamId] ?? 0) + amount;
	const next = computeStationOwnership(deposits);
	if (next.ownerTeamId === teamId && next.margin > maxChipLead) {
		throw new Error(`Deposit would exceed max lead of ${maxChipLead}`);
	}
	return next;
}
