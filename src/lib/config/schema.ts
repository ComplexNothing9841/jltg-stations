import { z } from 'zod';

const challengeTypeSchema = z.enum(['standard', 'steal', 'multiplier', 'call-your-shot']);

const teamConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	color: z.string().min(1)
});

const stationChallengeConfigSchema = z.object({
	id: z.string().min(1),
	type: challengeTypeSchema,
	baseValue: z.number().int().nonnegative(),
	latitude: z.number().optional(),
	longitude: z.number().optional()
});

const stationConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	latitude: z.number(),
	longitude: z.number(),
	adjacentStationIds: z.array(z.string().min(1)).default([]),
	mapLabel: z.string().optional(),
	challenge: stationChallengeConfigSchema
});

const gameplayRulesSchema = z
	.object({
		initialBoardSize: z.number().int().positive(),
		refillSize: z.number().int().positive(),
		boardMax: z.number().int().positive(),
		failureBoostPercent: z.number().nonnegative(),
		dayCount: z.number().int().positive(),
		dayMultipliers: z.array(z.number().positive()),
		maxChipLead: z.number().int().positive(),
		startingChipBalance: z.number().int().nonnegative()
	})
	.superRefine((value, ctx) => {
		if (value.dayMultipliers.length !== value.dayCount) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'dayMultipliers length must equal dayCount',
				path: ['dayMultipliers']
			});
		}
		if (value.initialBoardSize > value.boardMax) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'initialBoardSize cannot exceed boardMax',
				path: ['initialBoardSize']
			});
		}
	});

const mapManifestSchema = z
	.object({
		styleUrl: z.string().url().optional(),
		styleJson: z.record(z.string(), z.unknown()).optional(),
		initialView: z.object({
			center: z.tuple([z.number(), z.number()]),
			zoom: z.number().default(11),
			pitch: z.number().default(0),
			bearing: z.number().default(0)
		}),
		maxBounds: z
			.object({
				minLat: z.number(),
				maxLat: z.number(),
				minLng: z.number(),
				maxLng: z.number()
			})
			.optional()
	})
	.superRefine((value, ctx) => {
		if (!value.styleUrl && !value.styleJson) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'map manifest requires either styleUrl or styleJson',
				path: ['styleUrl']
			});
		}
	});

export const gameConfigSchema = z
	.object({
		version: z.string().min(1),
		name: z.string().min(1),
		startTimestamp: z.number().int().positive().optional(),
		startingChallengeIds: z.array(z.string().min(1)).optional(),
		teams: z.array(teamConfigSchema).min(2),
		stations: z.array(stationConfigSchema).min(1),
		rules: gameplayRulesSchema,
		map: mapManifestSchema
	})
	.superRefine((value, ctx) => {
		if (!value.startingChallengeIds) return;
		const uniqueIds = [...new Set(value.startingChallengeIds)];
		if (uniqueIds.length !== value.startingChallengeIds.length) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'startingChallengeIds must not contain duplicates',
				path: ['startingChallengeIds']
			});
		}
		if (uniqueIds.length !== value.rules.initialBoardSize) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'startingChallengeIds length must equal rules.initialBoardSize',
				path: ['startingChallengeIds']
			});
		}
		const stationChallengeIds = new Set(
			value.stations
				.map((station) => station.challenge?.id)
				.filter((challengeId): challengeId is string => Boolean(challengeId))
		);
		for (const challengeId of uniqueIds) {
			if (!stationChallengeIds.has(challengeId)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Unknown challenge ID in startingChallengeIds: ${challengeId}`,
					path: ['startingChallengeIds']
				});
			}
		}
	});

export type ChallengeType = z.infer<typeof challengeTypeSchema>;
export type GameplayRules = z.infer<typeof gameplayRulesSchema>;
export type GameConfig = z.infer<typeof gameConfigSchema>;
