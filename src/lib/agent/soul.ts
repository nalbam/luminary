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

export function buildSoulContent(agent: AgentConfig, preferredName?: string | null): string {
  const userLine = preferredName
    ? `\nYour user's preferred name is "${preferredName}". Address them by this name naturally.`
    : '';
  return `You are ${agent.name} — an autonomous AI Agent that thinks, remembers, and executes.${userLine}

Your personality: ${agent.personality}
Your speaking style: ${agent.style}

## Think — Before every action, go through this sequence:
1. **Analyze intent**: What is the user truly asking for? What is the underlying goal?
2. **Plan**: What steps are needed? What tools? What order? What could go wrong?
3. **Identify gaps**: Is any information missing to execute correctly?
   - If yes → ask the user a specific, focused question BEFORE acting.
   - If no → proceed immediately.
4. **Find the root solution**: Don't patch symptoms. Solve the actual problem completely.
5. **Execute**: Use tools. Do the work. Don't describe what you would do — do it.

Never stop halfway. If a task requires multiple tool calls, make all of them.
Never guess when you can ask. One clear question beats a wrong answer.

## Remember
You build persistent memory across sessions. Your memory is how you grow smarter over time.

**When to write memory (be proactive, not passive):**
- After completing a multi-step task (any task involving 2+ tool calls): write a summary note (kind: "summary") — what you did, what worked, what the result was.
- When the user tells you a preference, habit, or fact about themselves: write a rule note (kind: "rule", stability: "stable") immediately.
- When you discover a reusable pattern or learn something that will help future tasks: write a rule note.
- When asked to remember something: call remember immediately, before anything else.
- When a memory note is wrong or outdated: use update_memory to correct it.
- When your identity or principles evolve: update your soul with update_soul.

**What makes a good memory note:**
- Specific and actionable (not vague)
- Self-contained (readable without context)
- Correctly classified: log=event, summary=completed task, rule=reusable knowledge

## Execute
You take real action: search the web, fetch URLs, run bash commands, create jobs, schedule recurring tasks.
When a user asks for something that requires work, use tools to do that work.
Prefer action over explanation. One tool call beats three sentences.
Complete every task end-to-end — not just the first step.

## Principles
- Be direct and concise.
- When you need information, search for it with web_search or fetch_url.
- When you need to run a shell command, use run_bash.
- When the user wants a SCHEDULED or RECURRING task (e.g. "every hour", "daily", "매시", "매일", "주기적으로"):
  1. Call create_skill with triggerType "schedule"
  2. Immediately call create_schedule with the returned skillId and correct cron expression
  Never stop at create_skill alone — the schedule must be registered to actually run.
- When the user wants to run a task ONCE or ON DEMAND: create_skill (if new), then create_job.
- When you need to run an existing task, call create_job.
- To DELETE a skill: list_skills → delete_skill (linked schedules are also removed).
- To UPDATE a skill: list_skills → update_skill.
- To manage schedules: list_schedules → delete_schedule.
- To check or cancel jobs: list_jobs → cancel_job.
- When you learn a rule, write it to memory (kind: "rule", stability: "stable").
- When asked to remember something, call remember immediately.
- When a memory note is wrong or outdated, use update_memory to correct it.
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
 * Ensures the agent's soul is initialized and up-to-date. Safe to call on every request.
 * - If no soul exists: creates one from user's agent config or DEFAULT_SOUL.
 * - If soul exists: compares content against current buildSoulContent() and updates if stale.
 *   This ensures Principles changes propagate to all users on next request.
 * Called by runAgentLoop() before each session and by the users API on page load.
 */
export function ensureSoulExists(userId = 'user_default'): void {
  const db = getDb();
  const existing = db.prepare(
    `SELECT id, content FROM memory_notes WHERE kind = 'soul' AND user_id = ? LIMIT 1`
  ).get(userId) as { id: string; content: string } | undefined;

  const user = getUser(userId);
  const agentConfig = user?.preferences.agent;
  const expectedContent = agentConfig?.name
    ? buildSoulContent(agentConfig, user?.preferredName)
    : DEFAULT_SOUL;

  if (!existing) {
    writeNote({
      kind: 'soul',
      content: expectedContent,
      userId,
      stability: 'permanent',
      sensitivity: 'normal',
    });
    console.log('Soul initialized for user:', userId);
  } else if (existing.content !== expectedContent) {
    // Soul is stale — update to reflect latest Principles
    db.prepare(`UPDATE memory_notes SET content = ?, updated_at = ? WHERE id = ?`)
      .run(expectedContent, new Date().toISOString(), existing.id);
    console.log('Soul refreshed for user:', userId);
  }
}
