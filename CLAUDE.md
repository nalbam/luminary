# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

The SQLite database is auto-created at `data/vibemon.db` on first run. The `data/` directory is git-ignored.

## Architecture

This is a **Next.js 14+ App Router** application implementing an autonomous AI agent runtime. `better-sqlite3` and `sqlite-vec` are declared as `serverExternalPackages` in `next.config.ts` because they require native Node.js bindings.

### Four Runtime Loops (`src/lib/loops/`)

| Loop | File | Trigger |
|------|------|---------|
| Interactive | `interactive.ts` | HTTP POST `/api/chat` |
| Job | `runner.ts` | `enqueueJob()` + `runJob()` |
| Scheduler | `scheduler.ts` | `setInterval` every 60s, polls `schedules` table |
| Maintenance | `maintenance.ts` | HTTP POST `/api/maintenance` |

The scheduler uses a simplified cron parser (`parseCronInterval`) that only supports `*/N`, `0 * * * *`, and `0 0 * * *` patterns. Full cron expressions are not supported.

### Agentic Loop (Chat)

```
POST /api/chat
  → handleUserMessage (loops/interactive.ts)
    → ensureSoulExists (agent/soul.ts)       # initialize soul on first call
    → buildAgentContext (agent/context.ts)    # soul → rule → summary priority
    → runAgentLoop (agent/loop.ts)
      → saveUserMessage (memory/conversations.ts)
      → getConversationHistory               # multi-turn history
      → LLM call with 8 agent tools
      → if tool_calls → executeAgentTool() → saveToolResults()
      → if text → saveAssistantMessage() → return
      → repeat up to MAX_ITERATIONS (10)
```

### Data Flow for a Skill Job

```
POST /api/jobs  →  enqueueJob()  →  runJob()
  → planSkill (skills/planner.ts)      # LLM produces a Plan (steps[])
  → step_runs inserted per tool call
  → getTool(name).run()                 # from tool registry
  → writeNote (summary kind, volatile, ttl=7d)
```

### Database Schema (`src/lib/db/schema.sql`)

Six tables:
- `users` — user preferences
- `skills` — agent skill definitions (trigger_type: manual | schedule | event)
- `schedules` — cron-based triggers linked to skills
- `jobs` — job state machine (queued → running → succeeded/failed/canceled)
- `step_runs` — individual tool call records within a job
- `memory_notes` — four kinds: `log`, `summary`, `rule`, `soul`
- `conversations` — multi-turn chat history (user/assistant/assistant_tool_calls/tool_results)

The `memory_notes` table supports TTL via `expires_at`, stability levels (`volatile`/`stable`/`permanent`), and supersession via `superseded_by`. Soul notes are permanent agent identity notes.

### LLM Abstraction Layer (`src/lib/llm/`)

- `client.ts` — `getClient()` singleton factory, selects provider via `LLM_PROVIDER` env var
- `openai.ts` — OpenAI adapter (function_calling)
- `anthropic.ts` — Anthropic adapter (tool_use)
- `types.ts` — `LLMClient`, `LLMTool`, `ConversationMessage` interfaces

Both providers implement the same `LLMClient` interface. LLMTool.inputSchema **must include** `type: 'object'`.

### Agent Tools (`src/lib/agent/tools.ts`)

8 tools available during chat via the agentic loop:

| Tool | Purpose |
|------|---------|
| `remember` | Write a memory note |
| `list_memory` | Query memory notes |
| `update_soul` | Update agent identity (soul note) |
| `web_search` | Search the web (Brave → DuckDuckGo fallback) |
| `fetch_url` | Fetch a URL (SSRF-protected) |
| `list_skills` | List available skills |
| `create_job` | Create and run a skill job |
| `create_schedule` | Create a cron schedule |

### Tool Registry (`src/lib/tools/`)

Tools implement the `Tool` interface (`registry.ts`): `name`, `description`, `inputSchema`, `run(input, context)`.

Built-in tools (for job execution): `summarize`, `remember`, `list_memory`, `web_search`.

Register new tools by importing the tool file in `runner.ts` (self-registers via `registerTool()`).

### Memory System

- `src/lib/memory/notes.ts` — `NoteKind = 'log' | 'summary' | 'rule' | 'soul'`
- `src/lib/memory/conversations.ts` — multi-turn conversation history (MAX_ROWS=80)
- `src/lib/memory/users.ts` — `ensureUserExists()` initializes default user on first call; `getUser()`, `updateUser()`
- `src/lib/agent/context.ts` — `buildAgentContext()` with soul→rule→summary priority
- `src/lib/agent/soul.ts` — `ensureSoulExists()` initializes default soul on first call (Think→Remember→Execute identity)
- Soul notes: always filter by `!n.supersededBy` — old souls must not appear in system prompt
- User init: `handleUserMessage()` calls `ensureUserExists(userId)` before `runAgentLoop()`

### Vector Embeddings (`src/lib/memory/embeddings.ts`)

Uses `sqlite-vec` for storing/querying embeddings. Gracefully degrades if `sqlite-vec` is unavailable. Embeddings use OpenAI `text-embedding-3-small`. The `vec_notes` virtual table is used for vector similarity search.

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
