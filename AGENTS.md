## Project Overview

JLTG Stations is a local-first multiplayer station game built with:

- SvelteKit
- Svelte 5
- TypeScript
- MapLibre GL
- SQLocal + Drizzle ORM
- Zod validation
- Vitest

The application boots from a validated remote config, then operates entirely from a local state with manual replication/synchronization between devices.

---

## Development Commands

Install dependencies:

```bash
pnpm i
```

Start the development server:

```bash
pnpm dev
```

Quality checks:

```bash
pnpm format
pnpm lint
pnpm check
pnpm test
```

Database tooling:

```bash
pnpm db:push
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Regenerate the sample config:

```bash
pnpm config-gen
```

---

## Architecture

### Core Principles

- Local-first operation after bootstrap
- Deterministic game state where possible
- Offline-capable map experience
- Strong runtime validation with Zod
- Minimal server dependence
- Explicit/manual synchronization between devices

### Bootstrap Flow

When first loaded, the app:

1. Fetches remote config JSON
2. Validates config with Zod
3. Resolves map style and asset URLs
4. Pre-caches required map tiles
5. Seeds local SQLocal/Drizzle database
6. Allows team selection and local overrides
7. Initializes opening board state

After bootstrap, all reads/writes are local.

---

## Repository Expectations

### General

- Prefer strict TypeScript typing
- Avoid `any`
- Prefer pure functions for game logic
- Keep business logic outside UI components when practical
- Keep state transitions deterministic
- Validate all external data with Zod
- Avoid hidden side effects

### Svelte

- Prefer small, focused components
- Keep reactive logic readable
- Avoid deeply nested reactive statements
- Derive a state instead of duplicating it
- Prefer stores/services for a shared game state
- Use up-to-date Svelte 5 syntax

### Database

- Use Drizzle ORM for schema access
- Keep migrations deterministic
- Avoid implicit schema behavior
- Prefer explicit relational modeling

### Offline + Sync

- Never assume network availability after bootstrap
- Treat the local database as a source of truth
- Synchronization flows must be idempotent where possible
- Preserve deterministic conflict handling

---

## Game Config Rules

Expected top-level config shape:

```ts
{
  version: string
  name: string
  startTimestamp?: number
  startingChallengeIds?: string[]
  teams: Team[]
  stations: Station[]
  rules: Rules
  map: MapConfig
}
```

### Stations

Stations contain:

- Geographic coordinates
- Adjacency graph data
- Optional map labels
- Optional challenge metadata

Adjacency relationships should remain symmetric unless intentionally designing directed travel.

### Challenges

Supported challenge types:

- `standard`
- `steal`
- `multiplier`
- `call-your-shot`

Interpret `baseValue` according to challenge type semantics.

### Rules

Game logic should always defer to config-defined rules instead of hardcoded constants.

---

## Map System

The app uses MapLibre GL with offline-aware tile caching.

### Expectations

- Cache only necessary tile coverage
- Preserve offline usability
- Avoid unnecessary tile fetches
- Keep style resolution deterministic
- Support both `styleUrl` and inline `styleJson`

---

## Testing Expectations

Before submitting changes:

```bash
pnpm format
pnpm lint
pnpm check
pnpm test
```

Add tests for:

- Game state transitions
- Validation logic
- Synchronization logic
- Deterministic calculations
- Edge cases around offline behavior

Prefer testing business logic independently of UI rendering.

---

## Code Style

### Prefer

- Explicit naming
- Small composable functions
- Exhaustive switch handling
- Immutable update patterns
- Narrow types
- Data-oriented structures

### Avoid

- Hidden mutable shared state
- Large monolithic components
- Implicit runtime coercion
- Magic constants
- Coupling UI directly to persistence

---

## Important Constraints

- The app must remain functional offline after bootstrap
- Local persistence is authoritative
- Remote config is immutable during runtime unless explicitly refreshed
- Replication flows should tolerate duplicate inputs
- Deterministic behavior is preferred over convenience abstractions

---

## Suggested Areas of Separation

Recommended module boundaries:

- `lib/game/` → game rules and deterministic logic
- `lib/db/` → persistence and schema
- `lib/map/` → map integration and tile caching
- `lib/config/` → config validation/loading
- `lib/sync/` → manual replication workflows
- `lib/ui/` → presentational helpers/components

---

## Agent Guidance

When modifying this repository:

1. Preserve offline-first behavior
2. Preserve deterministic game logic
3. Validate all external inputs
4. Avoid introducing unnecessary dependencies
5. Keep synchronization flows explicit
6. Prefer readability to abstraction
7. Do not bypass type safety for convenience
8. Keep map behavior performant on low-connectivity devices

If adding new game mechanics:

- Ensure they serialize cleanly
- Ensure they are reproducible across devices
- Ensure they work without network access
- Ensure they can be replicated manually if necessary

```

```
