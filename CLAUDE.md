# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Execution Philosophy

This project is an autonomous AI Agent that **thinks**, **executes**, and **remembers**.

It defines the **goal and constraints** of a user request, **analyzes intent**, **forms a plan**, gathers the minimum information needed, then **directly executes and verifies**.
Results are **reported**, and lessons learned are accumulated as **reflections/memories**.

0. Define success criteria / constraints (Exit Criteria)
1. Analyze intent (Think)
2. Form a plan (Plan) + risk/permission check
3. Gather information (Research/Inspect) + minimal questions
4. Execute
5. Verify
6. Report
7. Reflect & Remember

## Commands

```bash
npm run dev      # Start development server (Next.js with Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test runner is configured — there are no test files in the project.

## Environment Setup

Copy `.env.example` to `.env.local` and set:
- `LLM_PROVIDER` — `openai` or `anthropic` (auto-selects if not set)
- `OPENAI_API_KEY` — required when using OpenAI (default)
- `ANTHROPIC_API_KEY` — required when using Anthropic
- `BRAVE_SEARCH_API_KEY` — optional; falls back to DuckDuckGo if absent

The SQLite database is auto-created at `data/luminary.db` on first run. The `data/` directory is git-ignored.

## Architecture

This is a **Next.js 16 App Router** application implementing an autonomous AI agent runtime. `better-sqlite3` and `sqlite-vec` are declared as `serverExternalPackages` in `next.config.ts` because they require native Node.js bindings.

### Four Runtime Loops (`src/lib/loops/`)

| Loop | File | Trigger |
|------|------|---------|
| Interactive | `interactive.ts` | HTTP POST `/api/chat` |
| Job | `runner.ts` | `enqueueJob()` + `runJob()` |
| Scheduler | `scheduler.ts` | Server start (`instrumentation.ts`) → `setInterval` every 60s, polls `schedules` table |
| Maintenance | `maintenance.ts` | Server start + every 6h (`instrumentation.ts`), also HTTP POST `/api/maintenance` |

The scheduler and maintenance loops are bootstrapped by `src/instrumentation.ts` (Next.js server instrumentation hook), which runs once when the Node.js server starts. The scheduler uses `node-cron` to register individual cron tasks per schedule row. All standard 5-field cron expressions are supported (UTC timezone). `syncSchedules()` polls the DB every 60 s to pick up newly created or modified schedules.

### Agentic Loop (Chat)

```
POST /api/chat
  → handleUserMessage (loops/interactive.ts)
    → ensureUserExists (memory/users.ts)
    → runAgentLoop (agent/loop.ts)
      → ensureIdentityExists (agent/soul.ts)   # sync agent/soul/user identity notes
      → saveUserMessage (memory/conversations.ts)
      → getConversationHistory               # multi-turn history
      → buildAgentContext (agent/context.ts)    # agent→soul→OS→user→rules→summaries, semantic retrieval
      → LLM call with 21 agent tools
      → if tool_calls → executeAgentTool() → saveToolResults()
      → if text → saveAssistantMessage() → auto-summary (1+ tools) → return
      → repeat up to MAX_ITERATIONS (10)
```

### Data Flow for a Routine Job

```
POST /api/jobs  →  enqueueJob()  →  runJob()
  → planRoutine (skills/planner.ts)    # LLM produces a Plan (steps[])
  → step_runs inserted per tool call
  → getTool(name).run()                # from tool registry
  → writeNote (summary kind, volatile, ttl=7d)
```

### Database Schema (`src/lib/db/schema.sql`)

Eight tables:
- `users` — user preferences
- `routines` — multi-step task recipes (name, goal, tools, trigger_type: manual | schedule | event)
- `skills` — integration modules (type: telegram | slack | webhook | custom; config, status)
- `schedules` — cron-based triggers; `action_type='routine'` or `action_type='tool_call'`
- `jobs` — job state machine (queued → running → succeeded/failed/canceled); links to `routine_id` or `tool_name`
- `step_runs` — individual tool call records within a job
- `memory_notes` — six kinds: `log`, `summary`, `rule`, `soul`, `agent`, `user`
- `conversations` — multi-turn chat history (user/assistant/assistant_tool_calls/tool_results)

The `memory_notes` table supports TTL via `expires_at`, stability levels (`volatile`/`stable`/`permanent`), and supersession via `superseded_by`. Soul notes are permanent agent identity notes.

### LLM Abstraction Layer (`src/lib/llm/`)

- `client.ts` — `getClient()` singleton factory, selects provider via `LLM_PROVIDER` env var
- `openai.ts` — OpenAI adapter (function_calling)
- `anthropic.ts` — Anthropic adapter (tool_use)
- `types.ts` — `LLMClient`, `LLMTool`, `ConversationMessage` interfaces

Both providers implement the same `LLMClient` interface. LLMTool.inputSchema **must include** `type: 'object'`.

### Agent Tools (`src/lib/agent/tools.ts`)

21 tools available during chat via the agentic loop:

| Tool | Purpose |
|------|---------|
| `remember` | Write a memory note |
| `list_memory` | Query memory notes |
| `update_memory` | Update/correct an existing memory note (supersede pattern) |
| `update_soul` | Update agent identity (soul note) |
| `web_search` | Search the web (Brave → DuckDuckGo fallback) |
| `fetch_url` | Fetch a URL (SSRF-protected) |
| `run_bash` | Execute a shell command (stdout/stderr/exitCode) |
| `list_routines` | List available routines |
| `create_routine` | Create a new routine (name, goal, tools) |
| `update_routine` | Update an existing routine |
| `delete_routine` | Delete a routine (also removes linked schedules and queued jobs) |
| `list_skills` | List integration skills |
| `create_skill` | Create an integration (type: telegram/slack/webhook/custom) |
| `create_schedule` | Create a cron schedule (routineId OR toolName+toolInput) |
| `list_schedules` | List active schedules |
| `update_schedule` | Update a schedule's cron expression, enabled state, or target |
| `delete_schedule` | Delete a schedule |
| `create_job` | Create and run a routine job |
| `list_jobs` | List recent jobs |
| `cancel_job` | Cancel a queued job |
| `notify` | Send a notification (Telegram → Slack → memory log fallback) |

### Tool Registry (`src/lib/tools/`)

Tools implement the `Tool` interface (`registry.ts`): `name`, `description`, `inputSchema`, `run(input, context)`.

Built-in tools (for job execution): `summarize`, `remember`, `list_memory`, `web_search`, `bash`.

Register new tools by importing the tool file in `runner.ts` (self-registers via `registerTool()`).

### Memory System

- `src/lib/memory/notes.ts` — `NoteKind = 'log' | 'summary' | 'rule' | 'soul' | 'agent' | 'user'`
- `src/lib/memory/conversations.ts` — multi-turn conversation history (MAX_ROWS=80)
- `src/lib/memory/users.ts` — `ensureUserExists()` initializes default user on first call; `getUser()`, `updateUser()`
- `src/lib/agent/context.ts` — `buildAgentContext()` with agent→soul→OS→user→rules→summaries priority; semantic search when embeddings available
- `src/lib/agent/soul.ts` — `ensureIdentityExists()` syncs all 3 identity notes (agent/soul/user) per request; `ensureSoulExists` is a backward-compat alias
- Identity notes (`soul`, `agent`, `user`): always filter by `!n.supersededBy` — superseded notes must not appear in system prompt
- User init: `handleUserMessage()` calls `ensureUserExists(userId)` before `runAgentLoop()`

### Vector Embeddings (`src/lib/memory/embeddings.ts`)

Uses `sqlite-vec` for storing/querying embeddings. Gracefully degrades if `sqlite-vec` is unavailable. Embeddings use OpenAI `text-embedding-3-small`. Two runtime-only tables: `vec_notes` (virtual, stores float[1536]) and `vec_note_map` (UUID↔INTEGER rowid mapping). These are NOT in `schema.sql` — created separately in `getDb()` after sqlite-vec load.

### Event Store (`src/lib/events/store.ts`)

Append-only JSONL files at `data/events/{date}/{userId}.jsonl`. Separate from SQLite — used for audit/replay, not queried by the agent.

## Key Conventions

- Database access always goes through `getDb()` from `src/lib/db/index.ts` (singleton with WAL mode)
- JSON fields in SQLite (`tags`, `tools`, `preferences`, etc.) are stored as JSON strings; always `JSON.parse`/`JSON.stringify`
- All timestamps stored as ISO 8601 strings; SQLite `datetime('now')` used for defaults
- Default `userId` is `'user_default'` when none provided
- The `data/` directory at project root holds runtime data — never commit its contents
- **Dual schema rule**: always modify both `schema.sql` and the inline fallback in `db/index.ts`
- `runJob()` must never be `await`ed — fire-and-forget only
- Next.js 15+ dynamic params: `const { id } = await params`
