CREATE TABLE IF NOT EXISTS config_snapshot (
  id TEXT PRIMARY KEY NOT NULL,
  config_url TEXT NOT NULL,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS session_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS station (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  map_label TEXT
);

CREATE TABLE IF NOT EXISTS station_connection (
  id TEXT PRIMARY KEY NOT NULL,
  from_station_id TEXT NOT NULL,
  to_station_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge (
  id TEXT PRIMARY KEY NOT NULL,
  station_id TEXT NOT NULL,
  type TEXT NOT NULL,
  base_value INTEGER NOT NULL,
  current_value INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  failure_count_total INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS board_challenge (
  id TEXT PRIMARY KEY NOT NULL,
  challenge_id TEXT NOT NULL,
  status TEXT NOT NULL,
  slot_order INTEGER NOT NULL,
  activated_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS station_deposit (
  id TEXT PRIMARY KEY NOT NULL,
  station_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  action_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge_attempt (
  id TEXT PRIMARY KEY NOT NULL,
  board_id TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  quantity INTEGER,
  reward_delta INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  action_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_log (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
);
