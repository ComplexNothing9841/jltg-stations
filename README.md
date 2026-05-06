# JLTG Stations

Offline-first SvelteKit app based on Jet Lag: The Game S17. See https://www.reddit.com/r/JetLagTheGame/comments/1t4quei/

## Development

- `pnpm i`
- `pnpm dev`
- `pnpm format`
- `pnpm lint`
- `pnpm check`

## Config shape

The app expects a remote JSON document with:

- `version`: string
- `name`: string
- `startTimestamp?`: optional Unix timestamp (seconds) when the game starts
- `startingChallengeIds?`: optional fixed opening board challenge IDs (must match `rules.initialBoardSize`)
- `teams`: `{ id, name, color }[]`
- `stations`: `{ id, name, latitude, longitude, adjacentStationIds, mapLabel?, challenge? }[]`
- `rules`: `{ initialBoardSize, refillSize, boardMax, failureBoostPercent, dayCount, dayMultipliers, maxChipLead, startingChipBalance }`
- `map`: `{ styleUrl? | styleJson?, initialView }`

Station challenges support:

- `id`
- `type`: `standard | steal | multiplier | call-your-shot`
- `baseValue` (For `call-your-shot`, this is the per-unit value, for `steal`/`multiplier` this is the percentage, for `standard` this is this chip value)
- `latitude?`
- `longitude?`

## Offline behavior

On first setup, the app:

1. Fetches and validates the config with Zod.
2. Resolves the map style, derives sprite/glyph/tile asset URLs inside the app, and caches only the tile coverage needed around the configured station bounds.
3. Saves the validated config snapshot into local SQLocal/Drizzle tables.
4. Seeds local tables for teams, stations, graph edges, challenges, deposits, attempts, and action logs.
5. Lets the local user choose their team and override start time.
6. If `startingChallengeIds` is provided, uses those IDs for the opening board automatically. Otherwise, lets the local user either generate the opening board locally or enter opening challenge IDs supplied by another team.

After bootstrap, the app reads and mutates only local state. Manual multi-device synchronization happens by entering station IDs or challenge IDs plus any other required values into the replication drawer.

## Notes

- The browser service worker precaches the app shell and runtime-caches fetched assets.
- Tile caching is generated from station latitude/longitude bounds and a set of config options to determine how detailed the caching is
