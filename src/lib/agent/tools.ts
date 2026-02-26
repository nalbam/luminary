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
        kind: { type: 'string', enum: ['log', 'summary', 'rule', 'soul'] },
        tags: { type: 'array', items: { type: 'string' } },
        limit: { type: 'number', description: 'Max results (default 10)' },
        query: { type: 'string', description: 'Natural language query for semantic search (requires OPENAI_API_KEY and sqlite-vec). Returns the most semantically similar notes.' },
      },
    },
  },
  async execute(input, ctx) {
    // Semantic search path: use vector similarity if query provided
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
        // Fall through to keyword search if semantic search fails
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
    description: 'Update an existing memory note by replacing its content. Use to correct, refine, or extend a previously written note. The old note is superseded and a new one is created.',
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
    if (existing.userId && existing.userId !== ctx.userId) {
      throw new Error('Cannot update another user\'s note');
    }

    const newNote = writeNote({
      kind: existing.kind === 'soul' ? 'rule' : existing.kind,
      content: input.content as string,
      userId: ctx.userId,
      tags: existing.tags,
      stability: existing.stability,
      ttlDays: existing.ttlDays,
    });

    const db = getDb();
    db.prepare(`UPDATE memory_notes SET superseded_by = ? WHERE id = ?`)
      .run(newNote.id, existing.id);

    return { noteId: newNote.id, success: true, message: 'Note updated' };
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

// ─── create_skill ─────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'create_skill',
    description: 'Create a new skill (automated task). Use when the user wants to define a new repeatable task. Returns the skillId that can be passed to create_job or create_schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Short name for the skill' },
        goal: { type: 'string', description: 'What the skill should accomplish (used by the planner to generate execution steps)' },
        triggerType: { type: 'string', enum: ['manual', 'schedule', 'event'], description: 'How the skill is triggered (default: manual)' },
        tools: { type: 'array', items: { type: 'string' }, description: 'Tool names the skill is allowed to use. Empty array = all tools' },
      },
      required: ['name', 'goal'],
    },
  },
  async execute(input) {
    const { createSkillForAgent } = await import('../tools/create_skill');
    return createSkillForAgent({
      name: input.name as string,
      goal: input.goal as string,
      triggerType: (input.triggerType as 'manual' | 'schedule' | 'event') || 'manual',
      tools: (input.tools as string[]) || [],
    });
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

// ─── run_bash ────────────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'run_bash',
    description: 'Execute a shell command and return stdout, stderr, and exit code. Use for file operations, running scripts, or any system-level task.',
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
    const result = await runBash(input.command as string, (input.timeout as number) || 30000);
    return result;
  },
});

// ─── create_schedule ──────────────────────────────────────────────────────────
agentTools.push({
  definition: {
    name: 'create_schedule',
    description: 'Create a recurring schedule for a skill using standard cron syntax (UTC timezone). Minimum interval: 5 minutes.',
    inputSchema: {
      type: 'object',
      properties: {
        skillId: { type: 'string', description: 'ID of the skill to schedule' },
        cronExpr: { type: 'string', description: 'Standard cron expression (UTC). Examples: "*/15 * * * *" (every 15min), "0 * * * *" (hourly), "0 9 * * *" (daily 9am), "0 9 * * 1" (Mon 9am)' },
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
