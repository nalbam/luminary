// src/lib/agent/soul.ts
import { getDb } from '../db';
import { writeNote } from '../memory/notes';
import { getUser } from '../memory/users';

export interface AgentConfig {
  name: string;
  personality: string;
  style: string;
}

export const DEFAULT_AGENT_PERSONALITY =
  'Helpful, thoughtful, and direct. Curious about the world and eager to assist.';

export const DEFAULT_AGENT_STYLE =
  'Conversational and warm, but concise. Gets to the point without being curt.';

function buildSoulContent(agent: AgentConfig, preferredName?: string | null): string {
  const userLine = preferredName
    ? `\nYour user's preferred name is "${preferredName}". Address them by this name naturally.`
    : '';
  return `You are ${agent.name} — an autonomous AI Agent that thinks, remembers, and executes.${userLine}

Your personality: ${agent.personality}
Your speaking style: ${agent.style}

## Think
You reason through problems step by step before acting.
You plan: what do I know? what do I need? what tools should I use?
You never just describe what you would do — you do it.

## Remember
You build persistent memory across sessions. When you learn something important, write a memory note.
When you discover a pattern or rule, write it with the remember tool (kind: "rule").
When your identity or principles evolve, update your soul with update_soul.
Your memory accumulates — you grow smarter over time.

## Execute
You take real action: search the web, fetch URLs, run bash commands, create jobs, schedule recurring tasks.
When a user asks for something that requires work, use tools to do that work.
Prefer action over explanation. One tool call beats three sentences.

## Principles
- Be direct and concise.
- When you need information, search for it with web_search or fetch_url.
- When you need to run a shell command, use run_bash.
- When you need to run a task, call create_job.
- When something repeats, call create_schedule.
- When you learn a rule, write it to memory (kind: "rule", stability: "stable").
- When asked to remember something, call remember immediately.
- Your soul and rules guide you — and you update them as you grow.`;
}

const DEFAULT_SOUL = buildSoulContent({
  name: 'vibemon-agent',
  personality: DEFAULT_AGENT_PERSONALITY,
  style: DEFAULT_AGENT_STYLE,
});

/**
 * Creates or updates the agent's soul note in-place.
 * Soul is a singleton per user — always one record, updated directly.
 */
export function applyAgentSoul(
  userId: string,
  agent: AgentConfig,
  preferredName?: string | null,
): void {
  const db = getDb();
  const content = buildSoulContent(agent, preferredName);
  const now = new Date().toISOString();

  const existing = db.prepare(
    `SELECT id FROM memory_notes WHERE kind = 'soul' AND user_id = ? LIMIT 1`
  ).get(userId) as { id: string } | undefined;

  if (existing) {
    db.prepare(`UPDATE memory_notes SET content = ?, updated_at = ? WHERE id = ?`)
      .run(content, now, existing.id);
  } else {
    writeNote({ kind: 'soul', content, userId, stability: 'permanent', sensitivity: 'normal' });
  }
}

/**
 * Ensures the agent's soul is initialized. Idempotent — safe to call on every request.
 * If user has configured an agent, uses their settings; otherwise falls back to defaults.
 * Called by runAgentLoop() before each session and by the users API on page load.
 */
export function ensureSoulExists(userId = 'user_default'): void {
  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM memory_notes WHERE kind = 'soul' AND user_id = ? LIMIT 1`
  ).get(userId);

  if (!existing) {
    const user = getUser(userId);
    const agentConfig = user?.preferences.agent;

    if (agentConfig?.name) {
      // Recreate with the user's personalized agent config
      applyAgentSoul(userId, agentConfig, user?.preferredName);
    } else {
      writeNote({
        kind: 'soul',
        content: DEFAULT_SOUL,
        userId,
        stability: 'permanent',
        sensitivity: 'normal',
      });
    }
    console.log('Soul initialized for user:', userId);
  }
}
