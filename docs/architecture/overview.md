# Architecture Overview

## System Architecture

vibemon-agent is a local-first agent runtime built on Next.js 14+ App Router. Four independent runtime loops operate with their own triggers, managing state through a shared SQLite DB and JSONL event store.

```mermaid
graph TB
    subgraph Browser["Web Browser"]
        UI[Chat / Skills / Jobs / Memory UI]
    end

    subgraph NextJS["Next.js App Router (src/app/)"]
        CHAT[POST /api/chat]
        JOBS[GET·POST /api/jobs]
        JOBID[GET·PATCH /api/jobs/:id]
        SKILLS[GET·POST /api/skills]
        SKILLID[GET·PUT·DELETE /api/skills/:id]
        SCHED[GET·POST /api/schedules]
        MEM[GET /api/memory]
        MAINT[POST /api/maintenance]
    end

    subgraph Loops["Runtime Loops (src/lib/loops/ + jobs/)"]
        IL[Interactive Loop\ninteractive.ts]
        JR[Job Runner\njobs/runner.ts]
        SL[Scheduler Loop\nscheduler.ts]
        ML[Maintenance Loop\nmaintenance.ts]
    end

    subgraph Core["Core Libraries (src/lib/)"]
        PLANNER[Skill Planner\nskills/planner.ts]
        TOOLS[Tool Registry\ntools/registry.ts]
        NOTES[Memory Notes\nmemory/notes.ts]
        CTX[Context Pack\nmemory/context-pack.ts]
        EMB[Embeddings\nmemory/embeddings.ts]
        EVENTS[Event Store\nevents/store.ts]
        ADAPT[Adapters\nadapters/]
    end

    subgraph Storage["Storage"]
        DB[(SQLite\ndata/vibemon.db)]
        JSONL[JSONL\ndata/events/YYYY-MM-DD/userId.jsonl]
    end

    UI --> CHAT & JOBS & JOBID & SKILLS & SKILLID & SCHED & MEM & MAINT
    CHAT --> ADAPT --> IL
    JOBS & JOBID --> JR
    MAINT --> ML
    SL -->|60s polling| DB
    SL --> JR

    IL --> CTX & EVENTS & NOTES
    JR --> PLANNER & TOOLS & NOTES & DB
    ML --> NOTES
    PLANNER --> TOOLS

    CTX --> NOTES
    NOTES --> DB
    EMB --> DB
    EVENTS --> JSONL
```

---

## Component Responsibilities

| Component | File | Role |
|-----------|------|------|
| Interactive Loop | `lib/loops/interactive.ts` | Receives user messages → builds memory context → calls LLM → records events |
| Job Runner | `lib/jobs/runner.ts` | Queues and executes skill jobs, manages tool call ordering, records step_runs |
| Scheduler Loop | `lib/loops/scheduler.ts` | Polls `schedules` table every 60 seconds, auto-executes interval-based jobs |
| Maintenance Loop | `lib/loops/maintenance.ts` | Deletes expired notes, batch-merges volatile notes older than 7 days |
| Skill Planner | `lib/skills/planner.ts` | Generates skill execution plan (`Plan`) using OpenAI gpt-4o-mini |
| Tool Registry | `lib/tools/registry.ts` | Defines `Tool` interface, name-based tool lookup map |
| Memory Notes | `lib/memory/notes.ts` | `memory_notes` CRUD, TTL expiration, note merging |
| Context Pack | `lib/memory/context-pack.ts` | Builds memory context to inject into OpenAI system prompt |
| Embeddings | `lib/memory/embeddings.ts` | `sqlite-vec` vector storage and search, OpenAI `text-embedding-3-small` |
| Event Store | `lib/events/store.ts` | Immutable JSONL audit log writing and reading |
| Input Adapter | `lib/adapters/input/web.ts` | HTTP request body → `WebInputMessage` type conversion and validation |
| Output Adapter | `lib/adapters/output/web.ts` | Internal response → `WebOutputMessage` type conversion |

---

## Chat Message Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as POST /api/chat
    participant A as Input Adapter
    participant IL as Interactive Loop
    participant CP as Context Pack
    participant DB as memory_notes (SQLite)
    participant EV as Event Store (JSONL)
    participant OAI as OpenAI gpt-4o-mini

    B->>API: { message, userId?, threadId? }
    API->>A: parseWebInput(body)
    A-->>API: { message, userId="user_default", threadId? }
    API->>IL: handleUserMessage(message, userId)

    IL->>EV: appendEvent({ type: "user_message", userId, payload })
    IL->>CP: buildContextPack(userId, message)
    CP->>DB: getNotes({ userId, limit: 20 })<br/>[expires_at>NOW, superseded_by IS NULL, sensitivity≠sensitive]
    DB-->>CP: MemoryNote[]
    CP-->>IL: { formattedText: "## Memory Context\n[log] ..." }

    IL->>OAI: chat.completions.create({ model: gpt-4o-mini,<br/>messages: [system(prompt+context), user(message)] })
    OAI-->>IL: response text

    IL->>EV: appendEvent({ type: "assistant_message", userId, payload })

    opt message.includes("remember") || "note"
        IL->>DB: writeNote({ kind: "log", stability: "volatile", ttlDays: 30 })
    end

    IL-->>API: { response }
    API-->>B: { response }
```

---

## Job Execution Flow

```mermaid
sequenceDiagram
    participant T as Trigger (API / Scheduler)
    participant R as Job Runner
    participant DB as SQLite
    participant P as Skill Planner
    participant OAI as OpenAI gpt-4o-mini
    participant Tool as Tool (registry)
    participant M as memory_notes

    T->>R: enqueueJob(skillId, triggerType, input, userId)
    R->>DB: INSERT jobs (status="queued")
    R-->>T: jobId

    Note over T,R: runJob() is fire-and-forget. Never awaited.
    T->>R: runJob(jobId) [no await]
    R->>DB: UPDATE jobs SET status="running", started_at=NOW

    R->>DB: SELECT * FROM skills WHERE id=skillId
    DB-->>R: skill { name, goal, tools:JSON }

    R->>P: planSkill(name, goal, tools, input)
    P->>OAI: chat.completions({ response_format: json_object })
    OAI-->>P: { steps: [{toolName, input}], reasoning }
    P-->>R: Plan

    loop Each step (sequential)
        R->>DB: INSERT step_runs (tool_name, input, started_at)
        R->>Tool: getTool(step.toolName).run(input, { userId, jobId })
        alt Success
            Tool-->>R: { output, artifactPath? }
            R->>DB: UPDATE step_runs (output, completed_at)
        else Failure
            Tool-->>R: { output: null, error }
            R->>DB: UPDATE step_runs (error, completed_at)
        end
    end

    R->>M: writeNote({ kind: "summary", stability: "volatile", ttlDays: 7 })
    R->>DB: UPDATE jobs SET status="succeeded", result=JSON, completed_at=NOW
```

---

## Layer Architecture

```mermaid
graph LR
    subgraph "Presentation"
        Pages[Next.js Pages\napp/**/page.tsx]
        Components[React Components\ncomponents/]
    end

    subgraph "API"
        Routes[API Routes\napp/api/**/route.ts]
        Adapters[Adapters\nlib/adapters/]
    end

    subgraph "Application"
        Loops[Loops\nlib/loops/]
        Jobs[Jobs\nlib/jobs/]
        Skills[Skills\nlib/skills/]
        Tools[Tools\nlib/tools/]
    end

    subgraph "Domain"
        Memory[Memory\nlib/memory/]
        Events[Events\nlib/events/]
    end

    subgraph "Infrastructure"
        DB[Database\nlib/db/]
        Storage[(SQLite + JSONL)]
    end

    Pages --> Routes
    Components --> Routes
    Routes --> Adapters
    Routes --> Loops
    Routes --> Jobs
    Routes --> Memory
    Loops --> Jobs
    Loops --> Memory
    Loops --> Events
    Jobs --> Skills
    Jobs --> Tools
    Jobs --> Memory
    Tools --> Memory
    Memory --> DB
    Events --> Storage
    DB --> Storage
```

**Dependency direction:** Upper layer → Lower layer. Reverse imports are forbidden.
