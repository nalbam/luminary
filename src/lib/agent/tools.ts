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
    description: 'Query memory notes. Use to recall past information before answering.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['log', 'summary', 'rule', 'soul'] },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
    },
  },
  async execute(input, ctx) {
    return getNotes({
      userId: ctx.userId,
      kind: input.kind as NoteKind | undefined,
      tags: input.tags as string[] | undefined,
      limit: (input.limit as number) || 10,
    });
  },
});

// ─── update_soul ──────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'update_soul',
    description: 'Update your own soul (identity/personality/principles). Use sparingly — only when you learn something fundamental about how you should behave.',
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
      for (const old of existing) {
        stmt.run(newNote.id, old.id);
      }
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
    description: 'Search the web for current information. Use when you need up-to-date facts.',
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
    description: 'Fetch and read the content of a URL. Use to read web pages, APIs, or documents.',
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

// ─── list_skills ─────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'list_skills',
    description: 'List all available skills (automated tasks) that can be run.',
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

// ─── create_job ───────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'create_job',
    description: 'Run a skill job immediately. Use when the user wants to execute a specific skill.',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: { type: 'string', description: 'ID of the skill to run (from list_skills)' },
        input: { type: 'object', description: 'Input parameters for the skill', additionalProperties: true },
      },
      required: ['skillId'],
    },
  },
  async execute(input, ctx) {
    const { createJobForAgent } = await import('../tools/create_job');
    return createJobForAgent(input.skillId as string, (input.input as Record<string, unknown>) || {}, ctx.userId);
  },
});

// ─── create_schedule ──────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'create_schedule',
    description: 'Create a recurring schedule for a skill. Supported cron patterns: "*/N * * * *" (every N min), "0 * * * *" (hourly), "0 0 * * *" (daily).',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: { type: 'string', description: 'ID of the skill to schedule' },
        cronExpr: { type: 'string', description: 'Cron expression, e.g. "0 9 * * *" for 9am daily' },
      },
      required: ['skillId', 'cronExpr'],
    },
  },
  async execute(input) {
    const { createScheduleForAgent } = await import('../tools/create_schedule');
    return createScheduleForAgent(input.skillId as string, input.cronExpr as string);
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
