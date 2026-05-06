import type { ChallengeType, GameConfig, GameplayRules } from '$lib/config/schema';

export type TeamSummary = {
	id: string;
	name: string;
	color: string;
	balance: number;
	controlledStations: number;
};

export type StationOwnership = {
	ownerTeamId: string | null;
	ownerColor: string | null;
	margin: number;
	depositsByTeam: Record<string, number>;
};

export type BoardChallengeView = {
	boardId: string | null;
	challengeId: string;
	stationId: string;
	type: ChallengeType;
	currentValue: number;
	failureCount: number;
	latitude: number;
	longitude: number;
	isActive: boolean;
};

export type StationSummary = {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	mapLabel?: string | null;
	challenge: BoardChallengeView;
	ownership: StationOwnership;
	googleMapsUrl: string;
};

type DepositHistoryEntry = {
	id: string;
	teamId: string;
	teamName: string;
	amount: number;
	createdAt: string;
};

type ChallengeAttemptView = {
	id: string;
	teamId: string;
	teamName: string;
	outcome: 'complete' | 'fail';
	rewardDelta: number;
	quantity: number | null;
	createdAt: string;
};

export type SelectedStationView = StationSummary & {
	deposits: DepositHistoryEntry[];
	attempts: ChallengeAttemptView[];
};

export type ActionSummary = {
	kind: 'deposit' | 'complete' | 'fail' | 'giveDebt' | 'receiveDebt';
	teamId: string;
	stationId: string;
	challengeId?: string;
	amount?: number;
	quantity?: number | null;
	spawnedChallengeIds?: string[];
};

export type ActionResult =
	| ActionSummary
	| { giveSummary: ActionSummary; receiveSummary: ActionSummary };

export type BootstrapMetadata = {
	configUrl: string;
	version: string;
	hash: string;
	cachedAssetUrls: string[];
	completedAt: string;
};

export type GameSession = {
	config: GameConfig;
	rules: GameplayRules;
	selectedTeamId: string | null;
	bootstrap: BootstrapMetadata | null;
	currentDay: number;
	startTimestamp: number | null;
	gameStarted: boolean;
};

type OfflineStatus = {
	shellReady: boolean;
	configReady: boolean;
	assetsReady: boolean;
	lastSyncAt?: string;
	message: string;
};

type TeamStats = {
	teamId: string;
	teamName: string;
	teamColor: string;
	totalInvestment: number;
	wastedChips: number;
	extraChips: number;
	efficientChips: number;
};

export type StatsSummary = {
	totalInvestment: number;
	teamStats: TeamStats[];
};

export type GameViewModel = {
	ready: boolean;
	loading: boolean;
	setupRequired: boolean;
	error: string | null;
	session: GameSession | null;
	teams: TeamSummary[];
	stations: StationSummary[];
	stationDetailsById: Record<string, SelectedStationView>;
	connections: Array<{ fromStationId: string; toStationId: string }>;
	offlineStatus: OfflineStatus;
	stats: StatsSummary | null;
};
