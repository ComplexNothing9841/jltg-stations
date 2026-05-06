import type { ActionResult, ActionSummary } from './types';

function formatSpawned(spawnedChallengeIds: string[] | undefined) {
	if (!spawnedChallengeIds?.length) return '';
	return ['New challenges:', ...spawnedChallengeIds].join('\n');
}

function formatAction(action: ActionSummary) {
	const spawned = formatSpawned(action.spawnedChallengeIds);

	if (action.kind === 'deposit') {
		return [
			`Deposited at a station!`,
			action.stationId,
			`Chips deposited: ${action.amount ?? 0}`
		].join('\n');
	}

	if (action.kind === 'complete') {
		const lines = [`Completed a challenge!`, action.challengeId ?? ''];
		if (typeof action.quantity === 'number') lines.push(`Completed ${action.quantity} units`);
		if (spawned) lines.push(spawned);
		return lines.join('\n');
	}

	if (action.kind === 'fail') {
		const lines = [`Failed a challenge`, action.challengeId ?? ''];
		if (spawned) lines.push(spawned);
		return lines.join('\n');
	}

	if (action.kind === 'giveDebt') {
		return [`Paid debt at a station`, action.stationId, `Debt amount: ${action.amount ?? 0}`].join(
			'\n'
		);
	}
}

export function buildShareMessage(result: ActionResult) {
	const actions = 'kind' in result ? [result] : [result.giveSummary, result.receiveSummary];
	return actions.map((action) => formatAction(action)).join('\n\n');
}
