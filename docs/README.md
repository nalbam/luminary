# Luminary — Developer Documentation

> **For AI contributors.** Read [Critical Invariants](#critical-invariants) before modifying any code.

## Document Index

| Document | Description |
|----------|-------------|
| [Architecture Overview](./architecture/overview.md) | System big picture, component relationships, data flow diagrams |
| [Data Model](./architecture/data-model.md) | Full SQLite schema, TypeScript types, event store structure |
| [Runtime Loops](./architecture/runtime-loops.md) | 4 runtime loop entry points, triggers, interactions |
| [Memory System](./architecture/memory-system.md) | Note kinds, TTL, context pack, vector embedding pipeline |
| [Guide: Add Tool](./guides/add-tool.md) | Step-by-step guide for adding new Tools (with code templates) |
| [Guide: Add API Route](./guides/add-api-route.md) | Guide for adding new API routes |
| [Guide: Modify Schema](./guides/modify-schema.md) | How to safely modify the DB schema |

---

## Critical Invariants

### Database Access

- **MUST** access the DB instance only through `getDb()` (`src/lib/db/index.ts`). Never call `new Database()` directly.
- **MUST** use `JSON.parse()` when reading and `JSON.stringify()` when writing JSON-stored columns.
  - JSON columns: `tags`, `tools`, `trigger_config`, `budget`, `output_config`, `memory_config`, `preferences`, `evidence`, `input`, `result`, `config`, `tool_input`
- **MUST** generate all timestamps as ISO 8601 strings using `new Date().toISOString()`.
- **NEVER** remove `better-sqlite3` from `serverExternalPackages`. It requires native bindings.

### Tool Registry

- **MUST** Tool files follow the side-effect import pattern, calling `registerTool()` at module top level.
- **MUST** import new Tool files at the top of `src/lib/jobs/runner.ts` for them to actually be registered. Without the import, `getTool(name)` returns `undefined`.
- **NEVER** call `getTool()` / `listTools()` directly anywhere other than `runner.ts`.

### Memory Notes

- **MUST** set `sensitivity: 'sensitive'` on notes containing sensitive information. `buildAgentContext()` automatically excludes them.
- **MUST** set `ttlDays` on notes with `stability: 'volatile'`.
- **NEVER** directly modify a note that has `superseded_by` set. Write a new note and link via `superseded_by`.
- **MUST** `getNotes()` queries with `expires_at > NOW AND superseded_by IS NULL` conditions. Expired and superseded notes are automatically excluded.
- Note kinds: `'log' | 'summary' | 'rule' | 'soul' | 'agent' | 'user'`. The `soul`, `agent`, and `user` kinds are system-managed identity notes (one per user). Do not write them directly — use `ensureIdentityExists()` or `applyAgentNote()`.

### API Routes

- **MUST** return all error responses as JSON in the form `{ error: string }`.
- **MUST** use HTTP 200 for GET/PUT/PATCH success, HTTP 201 for POST (creation).
- **NEVER** `await` `runJob()` in API routes. Use the fire-and-forget pattern (`runJob(id).catch(e => console.error(...))`).
- **MUST** await dynamic params in Next.js 15+: `const { id } = await params`.

### Scheduler

- **MUST** the scheduler checks the `schedulerStarted` flag to ensure `startScheduler()` runs only once.
- **MUST** not start the scheduler if `NEXT_PHASE === 'phase-production-build'`.
- Cron expressions use standard 5-field syntax via `node-cron` (UTC). Minimum interval: 5 minutes (`*/5 * * * *`).
- Schedules support two modes: `action_type='routine'` (LLM-planned multi-step) or `action_type='tool_call'` (direct single tool execution).

---

## Dependency Graph

```
src/
  app/              ← Next.js pages & API routes (entry points)
    api/            → lib/loops, lib/jobs, lib/memory, lib/db
    (pages)/        → components/

  components/       ← React UI (API calls only. No direct lib/ dependency)

  lib/
    db/             ← Bottom layer. No dependencies on other lib modules
    events/         ← Filesystem dependency. No dependency on db/
    llm/            ← LLM adapters (OpenAI, Anthropic). No dependency on db/
    adapters/       ← Input adapter. No dependencies
    memory/         → lib/db, lib/llm (embeddings)
    tools/          → lib/db, lib/memory
    skills/         → lib/llm, lib/tools (registry via listTools)
    agent/          → lib/llm, lib/memory, lib/tools
    jobs/           → lib/db, lib/tools, lib/memory, lib/skills
    loops/          → lib/agent, lib/jobs, lib/memory, lib/events
```

**Rule:** Upper layers import lower layers. Reverse imports are forbidden as they cause circular dependencies.
