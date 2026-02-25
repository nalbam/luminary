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

  const dbPath = path.join(dataDir, 'vibemon.db');
  db = new Database(dbPath);

  // Try to load sqlite-vec
  try {
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
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL REFERENCES skills(id),
        cron_expr TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
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
        kind TEXT NOT NULL CHECK (kind IN ('log','summary','rule')),
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
    `);
  }

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  return db;
}
