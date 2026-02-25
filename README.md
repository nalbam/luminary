# vibemon-agent

A local-first proactive agent runtime for macOS built with Next.js, Node.js, SQLite, sqlite-vec, and Tailwind CSS.

## Overview

vibemon-agent moves beyond request-response chatbots to become an always-on system that can do real work, remember what it did, and reuse that memory to serve users better over time.

## Features

- **Web Chat UI** – Interactive chat interface with streaming responses
- **Skill Editor** – Create and manage skill cards (manual, scheduled, or event-triggered)
- **Job Runner** – Async job execution with state machine (queued → running → succeeded/failed/canceled)
- **Scheduler** – Cron-based skill triggering
- **Memory System** – Three kinds of notes (log, summary, rule) with semantic recall via sqlite-vec
- **Tool Registry** – Extensible tool system (summarize, remember, list_memory, web_search, bash)
- **Maintenance Loop** – Periodic memory pruning, merging, and refreshing
- **Event Store** – Append-only JSONL event logging for auditability

## Tech Stack

- [Next.js 14+](https://nextjs.org/) with App Router
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) for SQLite
- [sqlite-vec](https://github.com/asg017/sqlite-vec) for vector embeddings
- [OpenAI API](https://openai.com/) for LLM capabilities
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
      jobs/               # GET/POST /api/jobs
      skills/             # GET/POST /api/skills
      schedules/          # GET/POST /api/schedules
      memory/             # GET /api/memory
      maintenance/        # POST /api/maintenance
    page.tsx              # Chat UI
    skills/page.tsx       # Skills editor
    jobs/page.tsx         # Jobs viewer
    memory/page.tsx       # Memory viewer
  components/             # React components
  lib/
    db/                   # SQLite database setup and schema
    events/               # Append-only event store (JSONL)
    tools/                # Tool registry and implementations
    skills/               # Skill planner
    jobs/                 # Job runner
    memory/               # Memory notes, context pack, embeddings
    loops/                # Runtime loops (interactive, scheduler, maintenance)
    adapters/             # Input/output adapters

data/                     # Local runtime data (git-ignored)
  vibemon.db              # SQLite database
  events/                 # JSONL event logs
```

## Architecture

### Four Runtime Loops

1. **Interactive Loop** – Handles user messages, builds memory context, calls OpenAI
2. **Job Loop** – Executes skill jobs asynchronously with tool calls
3. **Scheduled Loop** – Fires jobs based on cron expressions
4. **Maintenance Loop** – Prunes expired notes, merges duplicates, refreshes stale rules

### Memory Model

Three kinds of memory notes:
- **Log** – Raw event records for audit and replay
- **Summary** – Session/job outcomes (goal, what was done, evidence, next actions)
- **Rule** – Reusable knowledge with confidence, stability, TTL, and evidence references

### Tool Registry

Tools are the only way the agent can perform real work:
- `summarize` – Text summarization via LLM
- `remember` – Write a memory note
- `list_memory` – Retrieve memory notes
- `web_search` – Web search (stub, extensible)
- `bash` – Execute shell commands

## License

MIT
