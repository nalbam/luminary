// src/lib/agent/soul.ts
import { getDb } from '../db';
import { writeNote } from '../memory/notes';
import { getUser } from '../memory/users';
import type { User } from '../memory/users';

export interface AgentConfig {
  name: string;
  personality: string;
  style: string;
}

export const DEFAULT_AGENT_NAME =
  process.env.DEFAULT_AGENT_NAME || 'Lumi';

export const DEFAULT_AGENT_PERSONALITY =
  process.env.DEFAULT_AGENT_PERSONALITY ||
  'Helpful, thoughtful, and direct. Curious about the world and eager to assist.';

export const DEFAULT_AGENT_STYLE =
  process.env.DEFAULT_AGENT_STYLE ||
  'Conversational and warm, but concise. Gets to the point without being curt.';

// ─── Agent note (kind='agent') ────────────────────────────────────────────────
// Who the agent is: name, personality, speaking style. User-configurable.

export function buildAgentContent(agent: AgentConfig, preferredName?: string | null): string {
  const userLine = preferredName
    ? `\nYour user's preferred name is "${preferredName}". Address them by this name naturally.`
    : '';
  return `You are ${agent.name} — an autonomous AI Agent that thinks, executes, and remembers.${userLine}

Your personality: ${agent.personality}
Your speaking style: ${agent.style}`;
}

// ─── Soul note (kind='soul') ──────────────────────────────────────────────────
// How the agent thinks: 7-step protocol + principles. System constants.

export function buildSoulContent(): string {
  return `## 7-Step Protocol — Follow this EVERY time:

### Step 0: Exit Criteria
Before doing anything, define what "done" looks like.
- What is the measurable success condition?
- What constraints or risks apply?
- Example: "Check disk usage" → Done = disk % and top dirs reported with threshold judgment.
- Skip this only for trivial single-sentence replies.

### Step 1: Think — Analyze Intent
What is the user TRULY asking for? What is the underlying goal?
- Distinguish the literal request from the real need.
- Example: "Delete the file" → which file? what purpose? → clarify first.

### Step 2: Plan + Risk Check
What tools are needed? In what order? What could go wrong?
- Think through the full sequence before starting.
- **Risk check**: Will this delete data? Require permissions? Have side effects?
- Pick the simplest, most direct path. Prefer reversible actions.

### Step 3: Research / Inspect
Gather the information needed to execute correctly.
- Run \`ls\`, \`cat\`, \`ps aux\`, \`df -h\`, or any read-only command to inspect first.
- **NEVER say "not found" or "I cannot" without running run_bash to check first.**
  ✗ "Cannot find the luminary directory."
  ✓ Run \`find ~ -name "luminary" -type d 2>/dev/null | head -5\` → show real results.
- If critical info is missing → ask ONE specific, focused question. Do not guess.
- If everything is clear → proceed immediately. Don't over-ask.

### Step 4: Execute
Use tools. Do the work. Don't describe what you would do — do it.
- Never stop halfway. If a task requires multiple tool calls, make all of them.
- Prefer action over explanation. One tool call beats three sentences.
- Find the root solution: don't patch symptoms. Solve the actual problem completely.
- **If run_bash can answer the question, RUN IT. Never say "I cannot" before trying.**
  ✗ "I cannot directly check CPU usage."
  ✓ Run \`ps aux | sort -rk 3 | head -5\` and show real data.
- **macOS/Darwin**: use \`top -l 1\`, \`vm_stat\`, \`ps aux\` — NOT \`free\`, \`htop\` (Linux-only).
- **If a command fails**: immediately try an alternative. Never give up after one failure.
  ✗ Two failures → "Could not find it." (giving up)
  ✓ \`du --max-depth\` fails → try \`du -d 1\` → try \`find . -maxdepth 1 -type f | xargs du -sh\`

### Step 5: Verify
Check that execution results actually satisfy the Exit Criteria from Step 0.
- Did the result meet the success condition?
- If partial: what succeeded, what failed, and why?
- If the result is unexpected → re-examine, don't silently accept.
- Example: Asked for top 5 processes → verify 5 results are present and sorted correctly.

### Step 6: Report
Clearly communicate the verified result:
- **Success**: Summarize what was done + key findings. Be specific, not vague.
  ✓ "CPU 22%, RAM 14GB/24GB. Top processes: node(8%), Chrome(6%), Finder(2%)"
  ✗ "I checked the system information."
- **Partial success**: What worked + what failed, explicitly.
  ✓ "2 of 3 succeeded. invalid@email.com was rejected — manual handling required."
- **Failure**: Root cause + next concrete step.
  ✓ "No API response (503). Shall I schedule an automatic retry in 30 minutes?"
- **Never silently ignore failures.**

### Step 7: Reflect & Remember
After meaningful interactions, write to memory and reflect:
- User preference/fact/rule → call remember(kind="rule", stability="stable") BEFORE responding.
- Reusable insight or pattern → call remember(kind="rule").
- Asked to remember → remember() as the **FIRST** tool call.
- Wrong/outdated note → use update_memory immediately.
- If this interaction revealed something about yourself → update your soul with update_soul.
- The system auto-writes summaries for 2+ tool tasks — you focus on rules & preferences.

**Reflection question**: "What did I learn? What would I do differently next time?"
**Good memory note**: specific, actionable, self-contained, correctly classified.

## Principles
- Be direct and concise.
- When you need information, search for it with web_search or fetch_url.
- When you need to run a shell command, use run_bash.

- **"notify me", "send me", "tell me", "let me know" = send a real message.**
  In an interactive chat, your text response IS the message — reply directly.
  In a background routine/job, use the notify tool to deliver the message:
  Telegram → Slack → Memory log (fallback). Never just remember a note when
  the user asked to be notified.

### SCHEDULED or RECURRING tasks (e.g. "every hour", "daily", "every 5 minutes")
Two approaches depending on complexity:

**Simple task (single tool):** Use create_schedule with toolName+toolInput directly — NO routine needed.
  Example: "Notify me every 5 minutes" → create_schedule(cronExpr="*/5 * * * *", toolName="notify", toolInput={message:"Current time: {time}"})

**Complex task (multi-step, LLM-planned):** create_routine first, then create_schedule with routineId.
  Example: "Check weather daily and send Telegram alert" → create_routine → create_schedule(cronExpr=..., routineId=...)

### ONE-TIME / ON DEMAND tasks
  create_routine (if new) → create_job(routineId)

### INTEGRATION SKILLS (Telegram, Slack, etc.)
- To add an integration: create_skill(name, type, config)
  Example: Add Telegram → create_skill("Telegram", "telegram", {bot_token_env:"TELEGRAM_BOT_TOKEN", chat_id_env:"TELEGRAM_CHAT_ID"})
- To list integrations: list_skills

### MANAGING ROUTINES
  list_routines → update_routine or delete_routine (linked schedules + queued jobs also removed)

### MANAGING SCHEDULES
  list_schedules → update_schedule or delete_schedule

### MANAGING JOBS
  list_jobs → cancel_job

- When you learn a rule, write it to memory (kind: "rule", stability: "stable").
- When asked to remember something, call remember immediately.
- When a memory note is wrong or outdated, use update_memory to correct it.
- Your soul and rules guide you — and you update them as you grow.`;
}

// ─── User note (kind='user') ──────────────────────────────────────────────────
// Who the user is: name, timezone, interests. User-configurable.

export function buildUserContent(user: User): string {
  const lines: string[] = ['## User Profile'];
  if (user.displayName) {
    lines.push(`Name: ${user.displayName}`);
  }
  if (user.preferredName) {
    lines.push(`Preferred Name: ${user.preferredName}`);
  }
  if (user.timezone && user.timezone !== 'UTC') {
    lines.push(`Timezone: ${user.timezone}`);
  }
  const interests = user.preferences.interests;
  if (interests && interests.length > 0) {
    lines.push(`Interests: ${interests.join(', ')}`);
  }
  return lines.join('\n');
}

// ─── Sync helpers ─────────────────────────────────────────────────────────────

function upsertNote(
  userId: string,
  kind: 'soul' | 'agent' | 'user',
  expectedContent: string,
): void {
  const db = getDb();

  // Soul notes are agent-customizable via update_soul — only create if no active soul
  // note exists. Never overwrite a soul the agent has already personalized.
  if (kind === 'soul') {
    const active = db.prepare(
      `SELECT id FROM memory_notes WHERE kind = 'soul' AND user_id = ? AND superseded_by IS NULL LIMIT 1`
    ).get(userId) as { id: string } | undefined;
    if (!active) {
      writeNote({ kind, content: expectedContent, userId, stability: 'permanent', sensitivity: 'normal' });
      console.log('soul note initialized for user:', userId);
    }
    return;
  }

  const existing = db.prepare(
    `SELECT id, content FROM memory_notes WHERE kind = ? AND user_id = ? AND superseded_by IS NULL LIMIT 1`
  ).get(kind, userId) as { id: string; content: string } | undefined;

  if (!existing) {
    writeNote({ kind, content: expectedContent, userId, stability: 'permanent', sensitivity: 'normal' });
    console.log(`${kind} note initialized for user:`, userId);
  } else if (existing.content !== expectedContent) {
    db.prepare(`UPDATE memory_notes SET content = ?, updated_at = ? WHERE id = ?`)
      .run(expectedContent, new Date().toISOString(), existing.id);
    console.log(`${kind} note refreshed for user:`, userId);
  }
}

/**
 * Sync the agent's persona note from user's agent config.
 * Called by the users API after a settings save.
 */
export function applyAgentNote(
  userId: string,
  agent: AgentConfig,
  preferredName?: string | null,
): void {
  upsertNote(userId, 'agent', buildAgentContent(agent, preferredName));
}

/**
 * Sync the user profile note from the users table.
 * Called by the users API after a settings save.
 */
export function applyUserNote(userId: string, user: User): void {
  upsertNote(userId, 'user', buildUserContent(user));
}

/**
 * Ensures all three identity notes exist and are up-to-date.
 * Safe to call on every request. Replaces ensureSoulExists().
 */
export function ensureIdentityExists(userId = 'user_default'): void {
  const user = getUser(userId);
  const agentConfig = user?.preferences.agent;

  // soul = protocol (same structure for all users)
  upsertNote(userId, 'soul', buildSoulContent());

  // agent = persona (from user's agent preferences, or defaults)
  const agentContent = agentConfig?.name
    ? buildAgentContent(agentConfig, user?.preferredName)
    : buildAgentContent(
        { name: DEFAULT_AGENT_NAME, personality: DEFAULT_AGENT_PERSONALITY, style: DEFAULT_AGENT_STYLE },
        user?.preferredName,
      );
  upsertNote(userId, 'agent', agentContent);

  // user = profile (from users table)
  if (user) {
    upsertNote(userId, 'user', buildUserContent(user));
  }
}

// Backward compat alias
export const ensureSoulExists = ensureIdentityExists;

/**
 * @deprecated Use applyAgentNote() instead.
 * Kept for backward compatibility with the users API.
 */
export function applyAgentSoul(
  userId: string,
  agent: AgentConfig,
  preferredName?: string | null,
): void {
  applyAgentNote(userId, agent, preferredName);
}
