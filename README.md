# vibemon-agent

A local-first proactive agent runtime for macOS built with Next.js, Node.js, SQLite, sqlite-vec, and Tailwind CSS.

## Overview

vibemon-agent moves beyond request-response chatbots to become an always-on system that can do real work, remember what it did, and reuse that memory to serve users better over time.

## Features

- **Web Chat UI** – Interactive chat interface with multi-turn agentic loop (up to 10 tool-call iterations)
- **Routine Editor** – Create and manage routine cards (complex multi-step task recipes, LLM-planned)
- **Skills / Integrations** – Connect external services (Telegram, Slack, Webhook, etc.)
- **Job Runner** – Async job execution with state machine (queued → running → succeeded/failed/canceled)
- **Scheduler** – Cron-based triggering; runs a routine or a direct tool call
- **Memory System** – Four kinds of notes (log, summary, rule, soul) with semantic recall via sqlite-vec
- **21 Agent Tools** – remember, run_bash, web_search, fetch_url, notify, create_routine, create_schedule, update_schedule, and more
- **Maintenance Loop** – Periodic memory pruning, merging, and refreshing
- **Event Store** – Append-only JSONL event logging for auditability

## Tech Stack

- [Next.js 14+](https://nextjs.org/) with App Router
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for SQLite
- [sqlite-vec](https://github.com/asg017/sqlite-vec) for vector embeddings
- [OpenAI API](https://openai.com/) or [Anthropic API](https://anthropic.com/) for LLM (selectable via `LLM_PROVIDER`)
- [node-cron](https://github.com/node-cron/node-cron) for scheduling

## Getting Started

### Prerequisites

- Node.js 18+
- An OpenAI API key

### Installation

```bash
git clone https://github.com/nalbam/vibemon-agent
cd vibemon-agent
npm install
cp .env.example .env.local
# Edit .env.local and add your OPENAI_API_KEY
```

### Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
  app/                    # Next.js App Router pages and API routes
    api/
      chat/               # POST /api/chat – interactive chat
      jobs/               # GET/POST /api/jobs, PATCH /api/jobs/:id
      routines/           # GET/POST /api/routines, GET/PUT/DELETE /api/routines/:id
      skills/             # GET/POST /api/skills – integrations (Telegram, Slack…)
      schedules/          # GET/POST /api/schedules, DELETE /api/schedules/:id
      memory/             # GET /api/memory
      conversations/      # GET /api/conversations
      maintenance/        # POST /api/maintenance
    page.tsx              # Chat UI
    routines/page.tsx     # Routine editor
    skills/page.tsx       # Integrations viewer
    jobs/page.tsx         # Jobs viewer
    memory/page.tsx       # Memory viewer
    settings/page.tsx     # User settings
  lib/
    agent/                # Agentic loop, soul, context, tool definitions
    db/                   # SQLite database setup and schema
    events/               # Append-only event store (JSONL)
    llm/                  # LLM abstraction (OpenAI + Anthropic adapters)
    tools/                # Tool registry and job-execution tool implementations
    skills/               # Routine planner (planRoutine)
    jobs/                 # Job runner
    memory/               # Memory notes, embeddings, conversation history
    loops/                # Runtime loops (interactive, scheduler, maintenance)
    adapters/             # Input adapter (web.ts)

data/                     # Local runtime data (git-ignored)
  vibemon.db              # SQLite database
  events/                 # JSONL event logs
```

## Architecture

### Four Runtime Loops

1. **Interactive Loop** – Handles user messages, builds memory context, calls LLM (up to 10 tool-call iterations)
2. **Job Loop** – Executes routine jobs asynchronously; LLM plans steps, tools execute them
3. **Scheduled Loop** – Fires jobs based on cron expressions (full 5-field syntax, UTC)
4. **Maintenance Loop** – Prunes expired notes, merges duplicates, refreshes stale rules

### Memory Model

Four kinds of memory notes:
- **Soul** – Agent identity and principles (permanent, singleton per user)
- **Rule** – Reusable knowledge with confidence, stability, TTL, and evidence references
- **Summary** – Session/job outcomes written automatically after tool use
- **Log** – Raw event records for audit and replay

### Agent Tools (20)

Tools available during interactive chat via the agentic loop:

| Category | Tools |
|----------|-------|
| Memory | `remember`, `list_memory`, `update_memory`, `update_soul` |
| Web | `web_search`, `fetch_url` |
| Shell | `run_bash` |
| Routines | `list_routines`, `create_routine`, `update_routine`, `delete_routine` |
| Skills | `list_skills`, `create_skill` |
| Schedules | `list_schedules`, `create_schedule`, `update_schedule`, `delete_schedule` |
| Jobs | `list_jobs`, `create_job`, `cancel_job` |
| Notify | `notify` (Telegram → Slack → memory log fallback) |

## License

MIT
