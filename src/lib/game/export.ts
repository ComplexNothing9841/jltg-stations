import { getRawState } from '$lib/db/repository';

type RawState = Awaited<ReturnType<typeof getRawState>>;

type ExportPayload = {
	exportedAt: string;
	format: 'jltg-stations-export-v1';
	session: {
		selectedTeamId: string | null;
		gameStartTimestamp: number | null;
	};
	config: RawState['config'];
	board: Array<{
		id: string;
		challengeId: string;
		status: string;
		activatedAt: string;
		resolvedAt: string | null;
	}>;
	events: Array<{
		id: string;
		kind: string;
		createdAt: string;
		payload: Record<string, unknown>;
		teamId: string | null;
		stationId: string | null;
		related: {
			deposits: Array<{
				id: string;
				stationId: string;
				teamId: string;
				amount: number;
				createdAt: string;
			}>;
			attempts: Array<{
				id: string;
				boardId: string;
				challengeId: string;
				stationId: string;
				teamId: string;
				outcome: string;
				quantity: number | null;
				rewardDelta: number;
				createdAt: string;
			}>;
		};
	}>;
	unlinked: {
		deposits: Array<{
			id: string;
			actionId: string;
			stationId: string;
			teamId: string;
			amount: number;
			createdAt: string;
		}>;
		attempts: Array<{
			id: string;
			actionId: string;
			boardId: string;
			challengeId: string;
			stationId: string;
			teamId: string;
			outcome: string;
			quantity: number | null;
			rewardDelta: number;
			createdAt: string;
		}>;
	};
};

function safeParseJson(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return { _raw: value };
	}
}

function buildExportPayload(raw: RawState): ExportPayload {
	const depositsByActionId = new Map<string, typeof raw.deposits>();
	for (const deposit of raw.deposits) {
		const group = depositsByActionId.get(deposit.actionId);
		if (group) group.push(deposit);
		else depositsByActionId.set(deposit.actionId, [deposit]);
	}

	const attemptsByActionId = new Map<string, typeof raw.attempts>();
	for (const attempt of raw.attempts) {
		const group = attemptsByActionId.get(attempt.actionId);
		if (group) group.push(attempt);
		else attemptsByActionId.set(attempt.actionId, [attempt]);
	}

	const events = raw.actions
		.map((action) => {
			const payloadJson = safeParseJson(action.payload);
			const payload =
				payloadJson && typeof payloadJson === 'object'
					? (payloadJson as Record<string, unknown>)
					: { value: payloadJson };
			const teamId = typeof payload.teamId === 'string' ? payload.teamId : null;
			const stationId = typeof payload.stationId === 'string' ? payload.stationId : null;
			return {
				id: action.id,
				kind: action.kind,
				createdAt: action.createdAt,
				payload,
				teamId,
				stationId,
				related: {
					deposits: (depositsByActionId.get(action.id) ?? []).map((deposit) => ({
						id: deposit.id,
						stationId: deposit.stationId,
						teamId: deposit.teamId,
						amount: deposit.amount,
						createdAt: deposit.createdAt
					})),
					attempts: (attemptsByActionId.get(action.id) ?? []).map((attempt) => ({
						id: attempt.id,
						boardId: attempt.boardId,
						challengeId: attempt.challengeId,
						stationId: attempt.stationId,
						teamId: attempt.teamId,
						outcome: attempt.outcome,
						quantity: attempt.quantity,
						rewardDelta: attempt.rewardDelta,
						createdAt: attempt.createdAt
					}))
				}
			};
		})
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

	const eventActionIds = new Set(events.map((event) => event.id));
	return {
		exportedAt: new Date().toISOString(),
		format: 'jltg-stations-export-v1',
		session: {
			selectedTeamId: raw.selectedTeamId,
			gameStartTimestamp: raw.gameStartTimestamp ? Number(raw.gameStartTimestamp) : null
		},
		config: raw.config,
		board: raw.boardChallenges.map((entry) => ({
			id: entry.id,
			challengeId: entry.challengeId,
			status: entry.status,
			activatedAt: entry.activatedAt,
			resolvedAt: entry.resolvedAt ?? null
		})),
		events,
		unlinked: {
			deposits: raw.deposits
				.filter((deposit) => !eventActionIds.has(deposit.actionId))
				.map((deposit) => ({
					id: deposit.id,
					actionId: deposit.actionId,
					stationId: deposit.stationId,
					teamId: deposit.teamId,
					amount: deposit.amount,
					createdAt: deposit.createdAt
				})),
			attempts: raw.attempts
				.filter((attempt) => !eventActionIds.has(attempt.actionId))
				.map((attempt) => ({
					id: attempt.id,
					actionId: attempt.actionId,
					boardId: attempt.boardId,
					challengeId: attempt.challengeId,
					stationId: attempt.stationId,
					teamId: attempt.teamId,
					outcome: attempt.outcome,
					quantity: attempt.quantity,
					rewardDelta: attempt.rewardDelta,
					createdAt: attempt.createdAt
				}))
		}
	};
}

export async function exportGameData() {
	const raw = await getRawState();
	const payload = buildExportPayload(raw);
	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: 'application/json'
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	const stamp = payload.exportedAt.replaceAll(':', '-');
	link.href = url;
	link.download = `jltg-stations-${stamp}.json`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}
