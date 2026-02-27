# Runtime Loops

Luminary consists of four independent runtime loops. Each loop has a different trigger mechanism and communicates indirectly through the shared SQLite DB.

---

## Loop Overview

```mermaid
graph LR
    subgraph Triggers
        BOOT[Server Start\ninstrumentation.ts]
        HTTP[HTTP Request]
        TIMER60[setInterval 60s]
        TIMER6H[setInterval 6h]
        MANUAL[POST /api/maintenance]
    end

    subgraph Loops
        IL[Interactive Loop\nlib/loops/interactive.ts]
        JR[Job Runner\nlib/jobs/runner.ts]
        SL[Scheduler Loop\nlib/loops/scheduler.ts]
        ML[Maintenance Loop\nlib/loops/maintenance.ts]
    end

    BOOT -->|startScheduler| SL
    BOOT -->|runMaintenance + setInterval 6h| ML
    HTTP -->|POST /api/chat| IL
    HTTP -->|POST /api/jobs| JR
    HTTP -->|PATCH /api/jobs/:id| JR
    TIMER60 --> SL
    TIMER6H --> ML
    SL -->|enqueueJob + runJob| JR
    MANUAL -->|on-demand| ML
```

| Loop | Entry Point | Trigger | Sync/Async |
|------|-------------|---------|------------|
| Interactive | `handleUserMessage()` | POST /api/chat | Synchronous (await) |
| Job Runner | `enqueueJob()` + `runJob()` | API or Scheduler | Asynchronous (fire-and-forget) |
| Scheduler | `startScheduler()` | Server start → `setInterval` 60s | Asynchronous loop |
| Maintenance | `runMaintenance()` | Server start + every 6h + POST /api/maintenance | Synchronous (await) |

---

## 1. Interactive Loop

**File:** `src/lib/loops/interactive.ts`
**Entry:** `POST /api/chat` → `handleUserMessage(message, userId, threadId?)`

### Responsibilities
- Receives user messages and generates responses via the agentic loop
- Injects memory context into the system prompt
- Records conversation in persistent history
- Supports multi-turn dialogue with tool use (up to 10 iterations)

### Execution Order
```
1. ensureIdentityExists(userId)  ← sync agent/soul/user identity notes
2. buildAgentContext(userId) ← agent → soul → OS → user → rules → summaries priority
3. runAgentLoop(message, userId, systemPrompt)
   a. saveUserMessage(userId, message)
   b. getConversationHistory(userId)
   c. LLM call with tools
   d. If tool_calls → executeAgentTool() → saveToolResults()
   e. If text response → saveAssistantMessage() → return
   f. Repeat up to MAX_ITERATIONS (10)
4. return { response }
```

### Constraints
- Responses are not streamed — single completion response (`complete()`)
- Conversation history is trimmed to MAX_ROWS=80 entries

---

## 2. Job Runner

**File:** `src/lib/jobs/runner.ts`
**Entry:** `enqueueJob()` → (optional) `runJob()`

### Responsibilities
- Queues skill jobs into SQLite
- Generates execution plan (Plan) via skill planner
- Sequentially executes tools and records step_runs
- Creates summary memory note after job completion

### Two-Phase Separation

```typescript
// Phase 1: Queuing (synchronous)
const jobId = await enqueueJob(skillId, 'manual', input, userId);
// → INSERT into jobs table with status='queued'

// Phase 2: Execution (asynchronous, fire-and-forget)
runJob(jobId).catch(e => console.error('Job run error:', e));
// → Never awaited. API returns jobId immediately
```

### Internal Execution Flow

```
runJob(jobId):
  1. Fetch job from DB (throw if not found)
  2. UPDATE jobs SET status='running', started_at=NOW
  3. If routine_id is set:
     a. Fetch routine from DB
     b. planRoutine(name, goal, tools, input) → Plan { steps, reasoning }
        - Plan validation: unknown tool names cause plan failure (job → failed)
     c. Execute each step sequentially:
        - INSERT step_runs (tool_name, input, started_at)
        - getTool(step.toolName).run(input, { userId, jobId })
          - If tool not found: throw → job failed
          - If exception thrown: record step error and continue
          - If all steps fail: job → 'failed'
        - UPDATE step_runs (output/error, completed_at)
     d. writeNote({ kind: 'summary', stability: 'volatile', ttlDays: 7 })
  4. If tool_name is set (direct tool_call job):
     a. getTool(tool_name).run(tool_input, { userId, jobId })
  5. UPDATE jobs SET status='succeeded', result=JSON, completed_at=NOW
  6. On exception: UPDATE jobs SET status='failed', error=msg
```

### Important Design Decisions
- **Step failure does not abort the job.** A failed step records its error and continues to the next step.
- **Unregistered tools are soft failures.** If `getTool(name)` returns `undefined`, the job continues.
- Tool registration happens via side-effect imports at the top of `runner.ts`:
  ```typescript
  import '../tools/summarize';
  import '../tools/remember';
  import '../tools/search';
  import '../tools/list_memory';
  import '../tools/bash';
  import '../tools/fetch_url';
  import '../tools/notify';
  ```

---

## 3. Scheduler Loop

**File:** `src/lib/loops/scheduler.ts`
**Entry:** `startScheduler()` — called once from `src/instrumentation.ts` on server start

### Responsibilities
- On boot and every 60 s, calls `syncSchedules()` to pick up new or modified schedule rows
- Registers each enabled schedule as a `node-cron` task with the exact cron expression
- Fires `enqueueJob()` + `runJob()` when the cron fires
- Removes tasks for disabled/deleted schedules; re-registers when `cron_expr` changes

### Bootstrap

`startScheduler()` is invoked by the Next.js instrumentation hook:

```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startScheduler } = await import('./lib/loops/scheduler');
  startScheduler();
}
```

### Cron Expression Handling

Uses `node-cron` (`cron.validate()` + `cron.schedule()`). All valid 5-field cron expressions are supported (UTC timezone). Invalid expressions are logged and skipped.

```
*/5 * * * *   → every 5 minutes
0 9 * * 1-5  → weekdays 9am UTC
0 0 * * *    → daily midnight UTC
```

### Duplicate Execution Prevention

```typescript
let schedulerStarted = false;

export function startScheduler(): void {
  if (schedulerStarted) return;  // already started
  if (process.env.NEXT_PHASE === 'phase-production-build') return;  // skip during build
  schedulerStarted = true;
  syncSchedules();
  setInterval(syncSchedules, 60_000);  // re-sync every 60 s for runtime-added schedules
}
```

### Execution Logic

For each cron fire, the scheduler:
1. Updates `schedules.last_run_at`
2. For `action_type='tool_call'`: enqueues a job with no `routine_id`, sets `tool_name`/`tool_input` on the job row, then calls `runJob()` fire-and-forget
3. For `action_type='routine'`: enqueues a job linked to `routine_id`, then calls `runJob()` fire-and-forget

---

## 4. Maintenance Loop

**File:** `src/lib/loops/maintenance.ts`
**Entry:** Three triggers:
1. Server start — runs once 5 s after `src/instrumentation.ts` executes
2. Automatic — `setInterval` every 6 hours (started by `instrumentation.ts`)
3. On-demand — `POST /api/maintenance`

### Responsibilities
- Deletes expired memory notes
- LLM-synthesizes volatile notes older than 7 days into concise stable summaries, grouped by userId

### Execution Order

```
1. pruneExpired()
   → DELETE FROM memory_notes
     WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')
   → Returns count of deleted rows

2. getNotes({ limit: 200 })
   → Filter: stability='volatile' AND superseded_by IS NULL
   → Filter: createdAt < 7 days ago
   → Group by userId (never mix notes from different users)

3. Per userId group: if userNotes.length >= 3
   → Split into batches of 5
   → For each batch (length >= 2):
     a. synthesizeNotes(batch contents) via LLM (summary prompt)
        → Falls back to naive concatenation if LLM unavailable
     b. writeNote({ kind: 'summary', stability: 'stable', synthesized content })
     c. Mark each original note with superseded_by = new note ID
     d. merged++

4. return { pruned, merged, message }
```

### Return Type

```typescript
interface MaintenanceResult {
  pruned: number;  // Number of expired notes deleted
  merged: number;  // Number of batches synthesized (not note count)
  message: string; // Summary message
}
```

---

## Inter-Loop Communication

Loops communicate **indirectly through the SQLite DB** without direct calls:

```mermaid
graph LR
    SL[Scheduler] -->|INSERT jobs| DB[(SQLite)]
    JR[Job Runner] -->|READ/UPDATE jobs| DB
    IL[Interactive] -->|READ memory_notes| DB
    JR -->|INSERT memory_notes| DB
    ML[Maintenance] -->|DELETE/UPDATE memory_notes| DB
    IL -->|INSERT memory_notes| DB
```

**Exception:** Scheduler → Job Runner uses direct function calls (`enqueueJob` + `runJob`) because they operate within the same process.
