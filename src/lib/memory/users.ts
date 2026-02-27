// src/lib/memory/users.ts
import { getDb } from '../db';

export interface UserPreferences {
  onboarded?: boolean;
  interests?: string[];
  agent?: {
    name: string;
    personality: string;
    style: string;
  };
}

export interface User {
  id: string;
  displayName: string;
  preferredName: string | null;
  locale: string;
  timezone: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  display_name: string;
  preferred_name: string | null;
  locale: string;
  timezone: string;
  preferences: string;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    preferredName: row.preferred_name,
    locale: row.locale,
    timezone: row.timezone,
    preferences: JSON.parse(row.preferences || '{}') as UserPreferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLS =
  'id, display_name, preferred_name, locale, timezone, preferences, created_at, updated_at';

/**
 * Ensures a user record exists. Idempotent — safe to call on every request.
 * Creates the default user if none exists.
 */
export function ensureUserExists(userId = 'user_default'): User {
  const db = getDb();
  const existing = db.prepare(
    `SELECT ${SELECT_COLS} FROM users WHERE id = ?`
  ).get(userId) as UserRow | undefined;

  if (existing) return rowToUser(existing);

  const now = new Date().toISOString();
  const defaultPrefs: UserPreferences = { onboarded: false, interests: [] };

  const displayName = process.env.DEFAULT_USER_NAME || 'User';
  const locale = process.env.DEFAULT_USER_LOCALE || 'en';
  const timezone = process.env.DEFAULT_USER_TIMEZONE || 'UTC';

  db.prepare(`
    INSERT INTO users (id, display_name, preferred_name, locale, timezone, preferences, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, displayName, null, locale, timezone, JSON.stringify(defaultPrefs), now, now);

  console.log('User initialized:', userId);

  return {
    id: userId,
    displayName,
    preferredName: null,
    locale,
    timezone,
    preferences: defaultPrefs,
    createdAt: now,
    updatedAt: now,
  };
}

export function getUser(userId: string): User | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT ${SELECT_COLS} FROM users WHERE id = ?`
  ).get(userId) as UserRow | undefined;
  return row ? rowToUser(row) : null;
}

export interface UpdateUserInput {
  displayName?: string;
  preferredName?: string | null;
  locale?: string;
  timezone?: string;
  preferences?: Partial<UserPreferences>;
}

/**
 * Updates a user record. Preferences are deep-merged (not replaced).
 * Wrapped in a transaction to prevent lost-update race conditions.
 */
export function updateUser(userId: string, updates: UpdateUserInput): User | null {
  const db = getDb();

  return db.transaction(() => {
    const existing = db.prepare(
      `SELECT ${SELECT_COLS} FROM users WHERE id = ?`
    ).get(userId) as UserRow | undefined;
    if (!existing) return null;

    const currentPrefs: UserPreferences = JSON.parse(existing.preferences || '{}');
    const mergedPrefs: UserPreferences = {
      ...currentPrefs,
      ...(updates.preferences || {}),
      // deep merge agent sub-object if both exist
      ...(updates.preferences?.agent && currentPrefs.agent
        ? { agent: { ...currentPrefs.agent, ...updates.preferences.agent } }
        : {}),
    };

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE users SET
        display_name = ?,
        preferred_name = ?,
        locale = ?,
        timezone = ?,
        preferences = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      updates.displayName !== undefined ? updates.displayName : existing.display_name,
      updates.preferredName !== undefined ? updates.preferredName : existing.preferred_name,
      updates.locale !== undefined ? updates.locale : existing.locale,
      updates.timezone !== undefined ? updates.timezone : existing.timezone,
      JSON.stringify(mergedPrefs),
      now,
      userId,
    );

    return getUser(userId);
  })();
}
