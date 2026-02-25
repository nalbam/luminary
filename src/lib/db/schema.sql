-- users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  preferred_name TEXT,
  locale TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  preferences TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- skills table  
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'event')),
  trigger_config TEXT DEFAULT '{}',
  tools TEXT DEFAULT '[]',
  budget TEXT DEFAULT '{}',
  output_config TEXT DEFAULT '{}',
  memory_config TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  cron_expr TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  skill_id TEXT REFERENCES skills(id),
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','canceled')),
  input TEXT DEFAULT '{}',
  result TEXT,
  error TEXT,
  user_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

-- step_runs table (tool calls within a job)
CREATE TABLE IF NOT EXISTS step_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  tool_name TEXT NOT NULL,
  input TEXT DEFAULT '{}',
  output TEXT,
  error TEXT,
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  artifact_path TEXT
);

-- memory_notes table
CREATE TABLE IF NOT EXISTS memory_notes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('log','summary','rule','soul')),
  content TEXT NOT NULL,
  scope TEXT DEFAULT 'user',
  user_id TEXT,
  tags TEXT DEFAULT '[]',
  confidence REAL DEFAULT 1.0,
  stability TEXT DEFAULT 'stable' CHECK (stability IN ('volatile','stable','permanent')),
  ttl_days INTEGER,
  expires_at TEXT,
  sensitivity TEXT DEFAULT 'normal' CHECK (sensitivity IN ('normal','sensitive')),
  evidence TEXT DEFAULT '[]',
  job_id TEXT,
  superseded_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- conversations table (multi-turn chat history)
CREATE TABLE IF NOT EXISTS conversations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','assistant_tool_calls','tool_results')),
  content     TEXT NOT NULL,
  tool_use_id TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
