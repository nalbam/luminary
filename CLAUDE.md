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
- `OPENAI_API_KEY` — required for all LLM features (chat, skill planning, embeddings)

The SQLite database is auto-created at `data/vibemon.db` on first run. The `data/` directory is git-ignored.

## Architecture

This is a **Next.js 14+ App Router** application that implements an always-on agent runtime. `better-sqlite3` and `sqlite-vec` are declared as `serverExternalPackages` in `next.config.ts` because they require native Node.js bindings.

### Four Runtime Loops (`src/lib/loops/`)

| Loop | File | Trigger |
|------|------|---------|
| Interactive | `interactive.ts` | HTTP POST `/api/chat` |
| Job | `runner.ts` | `enqueueJob()` + `runJob()` |
| Scheduler | `scheduler.ts` | `setInterval` every 60s, polls `schedules` table |
| Maintenance | `maintenance.ts` | HTTP POST `/api/maintenance` |

The scheduler uses a simplified cron parser (`parseCronInterval`) that only supports `*/N`, `0 * * * *`, and `0 0 * * *` patterns. Full cron expressions are not supported.

### Data Flow for a Chat Message

```
POST /api/chat
  → parseWebInput (adapters/input/web.ts)
  → handleUserMessage (loops/interactive.ts)
    → appendEvent (events/store.ts)        # JSONL audit log
    → buildContextPack (memory/context-pack.ts)  # loads recent memory_notes
    → OpenAI gpt-4o-mini chat completion
    → writeNote (memory/notes.ts)          # only on "remember"/"note" keywords
```

### Data Flow for a Skill Job

```
POST /api/jobs  →  enqueueJob()  →  runJob()
  → planSkill (skills/planner.ts)      # OpenAI gpt-4o-mini produces a Plan (steps[])
  → step_runs inserted per tool call
  → getTool(name).run()                 # from tool registry
  → writeNote (summary kind, volatile, ttl=7d)
```

### Database Schema (`src/lib/db/schema.sql`)

Five tables:
- `users` — user preferences
- `skills` — agent skill definitions (trigger_type: manual | schedule | event)
- `schedules` — cron-based triggers linked to skills
- `jobs` — job state machine (queued → running → succeeded/failed/canceled)
- `step_runs` — individual tool call records within a job
- `memory_notes` — three kinds: `log`, `summary`, `rule`

The `memory_notes` table supports TTL via `expires_at`, stability levels (`volatile`/`stable`/`permanent`), and supersession via `superseded_by`.

### Tool Registry (`src/lib/tools/`)

Tools implement the `Tool` interface (`registry.ts`): `name`, `description`, `inputSchema`, `run(input, context)`.

Built-in tools:
- `summarize` — LLM text summarization
- `remember` — writes a `memory_notes` record
- `list_memory` — queries `memory_notes`
- `web_search` — stub, not yet implemented

Register new tools by importing the tool file in `runner.ts` (it self-registers on import via `registerTool()`).

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
