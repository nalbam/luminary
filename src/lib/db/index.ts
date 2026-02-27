import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'luminary.db');
  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  // Wait up to 30 s when the DB is locked by a concurrent writer (scheduler + job runner)
  db.pragma('busy_timeout = 30000');

  // Try to load sqlite-vec
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqliteVec = require('sqlite-vec');
    sqliteVec.load(db);
    console.log('sqlite-vec loaded successfully');
  } catch (e) {
    console.log('sqlite-vec not available, skipping vector features:', e);
  }

  // Run schema
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  } else {
    // Inline schema fallback
    db.exec(`
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
      CREATE TABLE IF NOT EXISTS routines (
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
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('telegram', 'slack', 'google_calendar', 'webhook', 'custom')),
        config TEXT DEFAULT '{}',
        status TEXT DEFAULT 'unconfigured' CHECK (status IN ('connected', 'unconfigured', 'error')),
        last_tested_at TEXT,
        enabled INTEGER DEFAULT 1,
        user_id TEXT DEFAULT 'user_default',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        routine_id TEXT REFERENCES routines(id),
        action_type TEXT NOT NULL DEFAULT 'routine'
          CHECK (action_type IN ('routine', 'tool_call')),
        tool_name TEXT,
        tool_input TEXT DEFAULT '{}',
        cron_expr TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        routine_id TEXT REFERENCES routines(id),
        tool_name TEXT,
        tool_input TEXT DEFAULT '{}',
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
      CREATE TABLE IF NOT EXISTS memory_notes (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('log','summary','rule','soul','agent','user')),
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
      CREATE TABLE IF NOT EXISTS conversations (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        role        TEXT NOT NULL CHECK (role IN ('user','assistant','assistant_tool_calls','tool_results')),
        content     TEXT NOT NULL,
        tool_use_id TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
    `);
  }

  // NOTE: vec_notes is intentionally NOT in schema.sql — virtual table DDL requires the
  // sqlite-vec extension to be loaded first. If added to schema.sql, db.exec(schema) would
  // fail entirely on systems without sqlite-vec. Keep this separate try/catch.
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS vec_notes USING vec0(embedding float[1536])`);
  } catch {
    // sqlite-vec not loaded — vector search unavailable, gracefully disabled
  }

  // Mapping table for vec_notes rowid (INTEGER) ↔ note_id (UUID)
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS vec_note_map (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT UNIQUE NOT NULL
    )`);
  } catch {
    // Ignore if already exists or sqlite-vec not available
  }

  // Cleanup: remove superseded soul notes (legacy records from before in-place update)
  db.exec(`DELETE FROM memory_notes WHERE kind = 'soul' AND superseded_by IS NOT NULL`);

  return db;
}
