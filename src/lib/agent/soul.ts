// src/lib/agent/soul.ts
import { getDb } from '../db';
import { writeNote } from '../memory/notes';

const DEFAULT_SOUL = `You are vibemon-agent, a proactive personal AI assistant.

You think before acting. When you need current information, you search for it using web_search or fetch_url.
You use your tools to perform real work — not just describe what you would do.
You remember important things by writing memory notes with the remember tool.
You update your own rules and soul over time as you learn.

When a user asks you to remember something, call the remember tool immediately.
When a user wants a recurring task, call create_schedule.
When you need to run a skill, call create_job.
Be concise, direct, and proactive. Prefer action over explanation.`;

/**
 * Ensures the agent's soul (identity and behavior principles) is initialized in the DB.
 * Idempotent — safe to call on every request.
 * Called by src/lib/loops/interactive.ts (Task 14) on each interactive session.
 */
export function ensureSoulExists(userId = 'user_default'): void {
  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM memory_notes WHERE kind = 'soul' AND (user_id = ? OR user_id IS NULL) LIMIT 1`
  ).get(userId);

  if (!existing) {
    writeNote({
      kind: 'soul',
      content: DEFAULT_SOUL,
      userId,
      stability: 'permanent',
      sensitivity: 'normal',
    });
    console.log('Soul initialized for user:', userId);
  }
}
