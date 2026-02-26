// src/lib/agent/tools.ts
import type { LLMTool } from '../llm/types';
import { writeNote, getNotes } from '../memory/notes';
import { getDb } from '../db';
import type { NoteKind } from '../memory/notes';

interface AgentToolContext {
  userId: string;
}

interface AgentTool {
  definition: LLMTool;
  execute(input: Record<string, unknown>, ctx: AgentToolContext): Promise<unknown>;
}

const agentTools: AgentTool[] = [];

// ─── remember ───────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'remember',
    description: 'Write a memory note. Use to remember facts, rules, or summaries for future conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'What to remember' },
        kind: { type: 'string', enum: ['log', 'summary', 'rule'], description: 'log=event, summary=outcome, rule=reusable knowledge' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
      },
      required: ['content'],
    },
  },
  async execute(input, ctx) {
    const note = writeNote({
      kind: (input.kind as NoteKind) || 'log',
      content: input.content as string,
      userId: ctx.userId,
      tags: (input.tags as string[]) || [],
    });
    return { noteId: note.id, success: true };
  },
});

// ─── list_memory ─────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'list_memory',
    description: 'Query memory notes. Use to recall past information before answering. Pass a natural language "query" for semantic search, or use "kind"/"tags" for filtered lookup.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['log', 'summary', 'rule', 'soul', 'agent', 'user'] },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number', description: 'Max results (default 10)' },
        query: { type: 'string', description: 'Natural language query for semantic search (requires OPENAI_API_KEY and sqlite-vec).' },
      },
    },
  },
  async execute(input, ctx) {
    if (input.query && typeof input.query === 'string' && process.env.OPENAI_API_KEY) {
      try {
        const { getEmbedding, searchSimilar } = await import('../memory/embeddings');
        const { getNoteById } = await import('../memory/notes');
        const queryVec = await getEmbedding(input.query);
        const noteIds = await searchSimilar(queryVec, (input.limit as number) || 10);
        if (noteIds.length > 0) {
          const notes = noteIds
            .map(id => getNoteById(id))
            .filter((n): n is NonNullable<typeof n> => n !== null && !n.supersededBy && n.userId === ctx.userId);
          if (notes.length > 0) return notes;
        }
      } catch {
        // Fall through to keyword search
      }
    }
    return getNotes({
      userId: ctx.userId,
      kind: input.kind as NoteKind | undefined,
      tags: input.tags as string[] | undefined,
      limit: (input.limit as number) || 10,
    });
  },
});

// ─── update_memory ────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'update_memory',
    description: 'Update an existing memory note by replacing its content. Cannot update soul notes (protocol) — use update_soul instead.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the note to update (from list_memory)' },
        content: { type: 'string', description: 'New content to replace the existing note' },
      },
      required: ['id', 'content'],
    },
  },
  async execute(input, ctx) {
    const { getNoteById } = await import('../memory/notes');
    const existing = getNoteById(input.id as string);
    if (!existing) throw new Error(`Note ${input.id as string} not found`);
    if (existing.userId && existing.userId !== ctx.userId) throw new Error('Cannot update another user\'s note');
    if (existing.kind === 'soul') throw new Error('Cannot update soul (protocol) with update_memory. Use update_soul instead.');

    const newNote = writeNote({
      kind: existing.kind,
      content: input.content as string,
      userId: ctx.userId,
      tags: existing.tags,
      stability: existing.stability,
      ttlDays: existing.ttlDays,
    });

    const db = getDb();
    db.prepare(`UPDATE memory_notes SET superseded_by = ? WHERE id = ?`).run(newNote.id, existing.id);
    return { noteId: newNote.id, success: true, message: 'Note updated' };
  },
});

// ─── update_soul ──────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'update_soul',
    description: 'Update the 7-step protocol and operating principles (soul). Use sparingly — only when you learn something fundamental about how you should reason or behave. To change persona (name/personality/style), ask the user to update settings instead.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'New soul content (replaces existing)' },
      },
      required: ['content'],
    },
  },
  async execute(input, ctx) {
    const db = getDb();
    const updateSoul = db.transaction(() => {
      const existing = db.prepare(
        `SELECT id FROM memory_notes WHERE kind = 'soul' AND user_id = ?`
      ).all(ctx.userId) as Array<{ id: string }>;

      const newNote = writeNote({
        kind: 'soul',
        content: input.content as string,
        userId: ctx.userId,
        stability: 'permanent',
      });

      const stmt = db.prepare(`UPDATE memory_notes SET superseded_by = ? WHERE id = ?`);
      for (const old of existing) stmt.run(newNote.id, old.id);
      return newNote;
    });

    const newNote = updateSoul();
    return { noteId: newNote.id, success: true, message: 'Soul updated' };
  },
});

// ─── web_search ──────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'web_search',
    description: 'Search the web for current information.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  async execute(input) {
    const { doSearch } = await import('../tools/search');
    const results = await doSearch(input.query as string);
    return { query: input.query, results };
  },
});

// ─── fetch_url ────────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'fetch_url',
    description: 'Fetch and read the content of a URL.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        maxLength: { type: 'number', description: 'Max characters to return (default 8000)' },
      },
      required: ['url'],
    },
  },
  async execute(input) {
    const { fetchUrl } = await import('../tools/fetch_url');
    const content = await fetchUrl(input.url as string, (input.maxLength as number) || 8000);
    return { url: input.url, content };
  },
});

// ─── run_bash ────────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'run_bash',
    description: 'Execute a shell command and return stdout, stderr, and exit code.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
      },
      required: ['command'],
    },
  },
  async execute(input) {
    const { runBash } = await import('../tools/bash');
    return runBash(input.command as string, (input.timeout as number) || 30000);
  },
});

// ─── list_routines ────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'list_routines',
    description: 'List all routines (complex multi-step tasks). Use to find a routineId before running or scheduling.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  async execute() {
    const { listRoutinesForAgent } = await import('../tools/list_routines');
    return listRoutinesForAgent();
  },
});

// ─── create_routine ───────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'create_routine',
    description: 'Create a new routine (complex multi-step task recipe). The LLM will auto-plan execution steps. Returns routineId for use with create_job or create_schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name for the routine' },
        goal: { type: 'string', description: 'What the routine should accomplish' },
        triggerType: { type: 'string', enum: ['manual', 'schedule', 'event'], description: 'How the routine is triggered (default: manual)' },
        tools: { type: 'array', items: { type: 'string' }, description: 'Allowed tool names. Empty = all tools' },
      },
      required: ['name', 'goal'],
    },
  },
  async execute(input) {
    const { createRoutineForAgent } = await import('../tools/create_routine');
    return createRoutineForAgent({
      name: input.name as string,
      goal: input.goal as string,
      triggerType: (input.triggerType as 'manual' | 'schedule' | 'event') || 'manual',
      tools: (input.tools as string[]) || [],
    });
  },
});

// ─── update_routine ───────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'update_routine',
    description: 'Update an existing routine\'s name, goal, or allowed tools. Use list_routines first.',
    inputSchema: {
      type: 'object',
      properties: {
        routineId: { type: 'string', description: 'ID of the routine to update' },
        name: { type: 'string', description: 'New name (optional)' },
        goal: { type: 'string', description: 'New goal description (optional)' },
        tools: { type: 'array', items: { type: 'string' }, description: 'New allowed tools list (optional)' },
      },
      required: ['routineId'],
    },
  },
  async execute(input) {
    const { updateRoutineForAgent } = await import('../tools/update_routine');
    return updateRoutineForAgent({
      routineId: input.routineId as string,
      name: input.name as string | undefined,
      goal: input.goal as string | undefined,
      tools: input.tools as string[] | undefined,
    });
  },
});

// ─── delete_routine ───────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'delete_routine',
    description: 'Delete a routine by ID. Also deletes all associated schedules and cancels queued jobs. Use list_routines first.',
    inputSchema: {
      type: 'object',
      properties: {
        routineId: { type: 'string', description: 'ID of the routine to delete' },
      },
      required: ['routineId'],
    },
  },
  async execute(input) {
    const { deleteRoutineForAgent } = await import('../tools/delete_routine');
    return deleteRoutineForAgent(input.routineId as string);
  },
});

// ─── list_skills ─────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'list_skills',
    description: 'List integration skills (Telegram, Slack, Google Calendar, etc.) and their connection status.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  async execute() {
    const { listSkillsForAgent } = await import('../tools/list_skills');
    return listSkillsForAgent();
  },
});

// ─── create_skill ─────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'create_skill',
    description: 'Add an integration skill (Telegram, Slack, Google Calendar, webhook, or custom). Config can reference env vars (bot_token_env) or store values directly.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name for the integration' },
        type: { type: 'string', enum: ['telegram', 'slack', 'google_calendar', 'webhook', 'custom'], description: 'Integration type' },
        config: { type: 'object', additionalProperties: { type: 'string' }, description: 'Configuration. For Telegram: {bot_token_env, chat_id_env}. For Slack: {webhook_url_env}. For webhook: {url, method}.' },
      },
      required: ['name', 'type'],
    },
  },
  async execute(input) {
    const { createSkillForAgent } = await import('../tools/create_skill');
    return createSkillForAgent({
      name: input.name as string,
      type: input.type as 'telegram' | 'slack' | 'google_calendar' | 'webhook' | 'custom',
      config: (input.config as Record<string, string>) || {},
    });
  },
});

// ─── create_schedule ──────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'create_schedule',
    description: 'Create a recurring cron schedule. Two modes: (1) routine mode — pass routineId for multi-step tasks. (2) tool_call mode — pass toolName+toolInput for simple single-tool actions (e.g. "5분마다 알림"). Minimum interval: 5 minutes (UTC timezone).',
    inputSchema: {
      type: 'object',
      properties: {
        cronExpr: { type: 'string', description: 'Cron expression (UTC). Examples: "*/15 * * * *" (every 15min), "0 9 * * *" (daily 9am), "0 9 * * 1" (Mon 9am)' },
        routineId: { type: 'string', description: 'Routine ID — for multi-step tasks requiring LLM planning' },
        toolName: { type: 'string', description: 'Tool name — for simple direct tool calls (e.g. "notify", "run_bash")' },
        toolInput: { type: 'object', additionalProperties: true, description: 'Input for the tool (used with toolName)' },
      },
      required: ['cronExpr'],
    },
  },
  async execute(input) {
    const { createScheduleForAgent } = await import('../tools/create_schedule');
    return createScheduleForAgent({
      cronExpr: input.cronExpr as string,
      routineId: input.routineId as string | undefined,
      toolName: input.toolName as string | undefined,
      toolInput: input.toolInput as Record<string, unknown> | undefined,
    });
  },
});

// ─── list_schedules ───────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'list_schedules',
    description: 'List all registered cron schedules with their linked routines or tool actions.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  async execute() {
    const { listSchedulesForAgent } = await import('../tools/list_schedules');
    return listSchedulesForAgent();
  },
});

// ─── update_schedule ──────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'update_schedule',
    description: 'Update a cron schedule: change cron expression, enable/disable, or change its target routine or tool. Use list_schedules first to get the ID.',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleId: { type: 'string', description: 'ID of the schedule to update' },
        cronExpr: { type: 'string', description: 'New cron expression (5-field, UTC, min interval 5 minutes)' },
        enabled: { type: 'boolean', description: 'Enable or disable the schedule' },
        routineId: { type: 'string', description: 'New routine ID to link (set null to unlink)' },
        toolName: { type: 'string', description: 'New tool name for direct tool_call schedules' },
        toolInput: { type: 'object', description: 'New tool input for direct tool_call schedules', additionalProperties: true },
      },
      required: ['scheduleId'],
    },
  },
  async execute(input) {
    const db = (await import('../db')).getDb();
    const { validateCronExpr } = await import('../tools/cron-utils');
    const id = input.scheduleId as string;
    const existing = db.prepare('SELECT id FROM schedules WHERE id = ?').get(id);
    if (!existing) return { error: `Schedule ${id} not found` };

    const { cronExpr, enabled, routineId, toolName, toolInput } = input as {
      cronExpr?: string; enabled?: boolean; routineId?: string;
      toolName?: string; toolInput?: Record<string, unknown>;
    };

    if (cronExpr) {
      try { validateCronExpr(cronExpr); } catch (e) { return { error: String(e) }; }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    if (cronExpr !== undefined) { fields.push('cron_expr = ?'); values.push(cronExpr.trim()); }
    if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    if (routineId !== undefined) { fields.push('routine_id = ?'); values.push(routineId || null); }
    if (toolName !== undefined) { fields.push('tool_name = ?'); values.push(toolName || null); }
    if (toolInput !== undefined) { fields.push('tool_input = ?'); values.push(JSON.stringify(toolInput)); }

    if (fields.length === 0) return { error: 'No fields to update' };
    values.push(id);
    db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { success: true, scheduleId: id };
  },
});

// ─── delete_schedule ──────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'delete_schedule',
    description: 'Delete a cron schedule by ID. The routine itself is NOT deleted. Use list_schedules first.',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleId: { type: 'string', description: 'ID of the schedule to delete' },
      },
      required: ['scheduleId'],
    },
  },
  async execute(input) {
    const { deleteScheduleForAgent } = await import('../tools/delete_schedule');
    return deleteScheduleForAgent(input.scheduleId as string);
  },
});

// ─── create_job ───────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'create_job',
    description: 'Run a routine job immediately. Use when the user wants to execute a specific routine once.',
    inputSchema: {
      type: 'object',
      properties: {
        routineId: { type: 'string', description: 'ID of the routine to run (from list_routines)' },
        input: { type: 'object', description: 'Input parameters for the routine', additionalProperties: true },
      },
      required: ['routineId'],
    },
  },
  async execute(input, ctx) {
    const { createJobForAgent } = await import('../tools/create_job');
    return createJobForAgent(input.routineId as string, (input.input as Record<string, unknown>) || {}, ctx.userId);
  },
});

// ─── list_jobs ────────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'list_jobs',
    description: 'List recent jobs with their status. Use to check what jobs are running, queued, or completed.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max number of jobs to return (default 10)' },
      },
      required: [],
    },
  },
  async execute(input) {
    const { listJobsForAgent } = await import('../tools/list_jobs');
    return listJobsForAgent((input.limit as number) || 10);
  },
});

// ─── cancel_job ───────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'cancel_job',
    description: 'Cancel a queued job. Cannot cancel running or completed jobs. Use list_jobs first.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'ID of the job to cancel' },
      },
      required: ['jobId'],
    },
  },
  async execute(input) {
    const { cancelJobForAgent } = await import('../tools/cancel_job');
    return cancelJobForAgent(input.jobId as string);
  },
});

// ─── notify ───────────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'notify',
    description:
      'Send a notification message to the user via Telegram, Slack, or memory log fallback. ' +
      'Use when the user asks to be notified, alerted, or told something — "알려줘", "notify me", "send me", etc.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Notification message to send' },
      },
      required: ['message'],
    },
  },
  async execute(input, ctx) {
    const { sendNotification } = await import('../tools/notify');
    return sendNotification(input.message as string, ctx.userId);
  },
});

// ─── Public API ──────────────────────────────────────────────────────────────
export function getAgentTools(): LLMTool[] {
  return agentTools.map(t => t.definition);
}

export async function executeAgentTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentToolContext
): Promise<unknown> {
  const tool = agentTools.find(t => t.definition.name === name);
  if (!tool) throw new Error(`Agent tool "${name}" not found`);
  return tool.execute(input, ctx);
}
