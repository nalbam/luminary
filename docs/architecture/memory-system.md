# Memory System

vibemon-agent's memory system allows the agent to remember and reuse information. It consists of four kinds of notes (`log`, `summary`, `rule`, `soul`), TTL-based expiration, and vector embedding search.

---

## Note Kinds (4 Kinds)

```mermaid
graph LR
    subgraph kinds["note kind"]
        LOG[log\nRaw event record]
        SUMMARY[summary\nTask result summary]
        RULE[rule\nReusable knowledge]
        SOUL[soul\nAgent identity]
    end

    subgraph stability["stability"]
        V[volatile\nShort-term. ttlDays required]
        S[stable\nDefault]
        P[permanent\nNever expires]
    end

    LOG --> V
    SUMMARY --> V
    SUMMARY --> S
    RULE --> S
    RULE --> P
    SOUL --> P
```

| Kind | Purpose | Typical stability | ttlDays example |
|------|---------|-------------------|-----------------|
| `log` | Raw record of user requests and system events | `volatile` | 30 days |
| `summary` | Summary of job/session results (goal, actions taken, next steps) | `volatile` | 7 days |
| `rule` | Reusable knowledge. High confidence with evidence | `stable` / `permanent` | none |
| `soul` | Agent identity and behavioral principles. Permanent | `permanent` | none |

### Kind Selection Guide

```
User made a request / System event occurred
  → log

Job completed / Session ended
  → summary

Repeated pattern discovered / Rule to follow going forward
  → rule (confidence 0.8+, evidence[] required)

Agent identity / Core behavioral principles
  → soul (permanent, supersededBy chain for updates)
```

---

## Note Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active : writeNote()

    Active --> Expired : expires_at <= NOW\n(volatile/stable with ttl)
    Active --> Superseded : mergeNotes() or\nmanual superseded_by set
    Active --> Active : Always queryable

    Expired --> [*] : pruneExpired()\n(Maintenance Loop)
    Superseded --> [*] : Direct deletion (optional)

    note right of Active
        Returned by getNotes()
    end note

    note right of Expired
        Excluded by getNotes()
        (expires_at > NOW condition)
    end note

    note right of Superseded
        Excluded by getNotes()
        (superseded_by IS NULL condition)
    end note
```

### TTL Calculation

```typescript
// Inside writeNote()
if (input.ttlDays) {
  const exp = new Date();
  exp.setDate(exp.getDate() + input.ttlDays);
  expiresAt = exp.toISOString();
}
```

- Without `ttlDays`, `expires_at = NULL` → preserved permanently
- `stability: 'volatile'` notes without `ttlDays` become targets for the Maintenance Loop's 7-day batch merge

---

## Context Pack

The mechanism for injecting memory into the LLM prompt during chat response generation.

**File:** `src/lib/memory/context-pack.ts`

### Build Process

```typescript
function buildContextPack(userId: string, _query?: string): ContextPack {
  const notes = getNotes({ userId, limit: 20 })
    .filter(n => n.sensitivity !== 'sensitive' && !n.supersededBy);

  const formattedText = notes.length > 0
    ? `## Memory Context\n\n${notes.map(n => `[${n.kind}] ${n.content}`).join('\n\n')}`
    : '';

  return { notes: [...], formattedText };
}
```

### Filtering Rules

| Condition | Description |
|-----------|-------------|
| `expires_at > NOW` | Automatically applied inside `getNotes()` |
| `superseded_by IS NULL` | Automatically applied inside `getNotes()` |
| `sensitivity != 'sensitive'` | Additional filter in Context Pack |
| `limit: 20` | Most recent 20 only (created_at DESC) |
| `_query` | Currently unused (planned for vector search integration) |

### LLM Injection Location

```typescript
// lib/loops/interactive.ts
const systemPrompt = `You are vibemon-agent...

${contextPack.formattedText}  // ← injected here

Be helpful, concise...`;
```

**Note:** The `_query` parameter is not currently used for vector search. Planned for future integration with semantic search.

---

## Agent Context (Soul + Rules)

The `buildAgentContext()` function in `src/lib/agent/context.ts` builds the system prompt with priority ordering:

```typescript
function buildAgentContext(userId: string): string {
  // 1. Soul first: agent identity / behavioral principles
  const soulNotes = getNotes({ userId, kind: 'soul', limit: 5 })
    .filter(n => !n.supersededBy);

  // 2. Rules: learned user rules
  const ruleNotes = getNotes({ userId, kind: 'rule', limit: 10 })
    .filter(n => n.sensitivity !== 'sensitive' && !n.supersededBy);

  // 3. Recent context: recent task summaries
  const summaryNotes = getNotes({ userId, kind: 'summary', limit: 5 })
    .filter(n => n.sensitivity !== 'sensitive' && !n.supersededBy);
  // ...
}
```

**Priority order:** soul → rules → recent summaries

---

## Vector Embedding Pipeline

**File:** `src/lib/memory/embeddings.ts`

### Components

```mermaid
graph LR
    Text[Note content] -->|getEmbedding()| OAI[OpenAI\ntext-embedding-3-small\n1536 dimensions]
    OAI --> Vec[Float32Array]
    Vec -->|storeEmbedding()| VT[vec_notes virtual table\nsqlite-vec]

    Query[Search query] -->|getEmbedding()| OAI2[OpenAI]
    OAI2 --> QVec[Query vector]
    QVec -->|searchSimilar()| VT
    VT -->|L2 distance| NoteIDs[memory_notes.id list]
```

### API

```typescript
// Generate embedding (OpenAI API call)
async function getEmbedding(text: string): Promise<number[]>

// Store vector
async function storeEmbedding(noteId: string, vector: number[]): Promise<void>

// Search similar notes (L2 distance)
async function searchSimilar(queryVector: number[], limit?: number): Promise<string[]>
// → returns array of memory_notes.id
```

### Graceful Degradation

When `sqlite-vec` fails to load or virtual table is not created:
- `storeEmbedding()`: logs warning to console and returns (no error thrown)
- `searchSimilar()`: logs warning to console and returns empty array

**Current status:** `storeEmbedding()` / `searchSimilar()` are implemented but not yet called from `buildContextPack()`. Planned for future integration with the `_query` parameter.

---

## Memory Note API

**File:** `src/lib/memory/notes.ts`

### writeNote

```typescript
function writeNote(input: WriteNoteInput): MemoryNote

interface WriteNoteInput {
  kind: NoteKind;           // 'log' | 'summary' | 'rule' | 'soul'
  content: string;
  scope?: string;           // default: 'user'
  userId?: string;
  tags?: string[];          // default: []
  confidence?: number;      // default: 1.0
  stability?: 'volatile' | 'stable' | 'permanent';  // default: 'stable'
  ttlDays?: number;         // required for volatile
  sensitivity?: 'normal' | 'sensitive';  // default: 'normal'
  evidence?: string[];      // default: []
  jobId?: string;
}
```

### getNotes

```typescript
function getNotes(filter?: GetNotesFilter): MemoryNote[]

interface GetNotesFilter {
  userId?: string;
  kind?: NoteKind;
  scope?: string;
  tags?: string[];  // OR condition (any match)
  limit?: number;   // default: 50
}
```

**Note:** The `tags` filter is applied at the JavaScript level, not SQL level (SQLite JSON functions not used).

### pruneExpired

```typescript
function pruneExpired(): number  // returns count of deleted rows
```

Called by Maintenance Loop. Deletes by `expires_at <= NOW` condition.

### mergeNotes

```typescript
function mergeNotes(ids: string[]): MemoryNote | null
```

- Merges 2+ notes into a single `summary` note
- Marks original notes with `superseded_by = new note ID`
- Called by Maintenance Loop in batches of 5

---

## Memory Usage Patterns

### Currently Implemented Patterns

| Situation | Who writes | kind | stability | ttlDays |
|-----------|-----------|------|-----------|---------|
| User mentions "remember/note" | Interactive Loop | `log` | `volatile` | 30 |
| Job completed | Job Runner | `summary` | `volatile` | 7 |
| Agent tool `remember` called | Agent Tool | `log` (default) | `stable` | none |
| Agent tool `update_soul` called | Agent Tool | `soul` | `permanent` | none |

### Extension Points

When a new memory note needs to be created:
1. Call `writeNote()` directly (simplest)
2. Call via the `remember` agent tool during a chat session
3. Trigger from a new loop or event handler
