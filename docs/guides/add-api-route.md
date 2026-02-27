# Guide: Add API Route

Luminary uses Next.js 14+ App Router. All API routes are located under `src/app/api/` and follow the Route Handlers pattern.

---

## File Structure Convention

```
src/app/api/
  {resource}/
    route.ts          ← GET (list), POST (create)
    [id]/
      route.ts        ← GET (single), PUT (full update), PATCH (partial update), DELETE
```

**Example:**
```
src/app/api/tools/
  route.ts            ← GET /api/tools, POST /api/tools
  [id]/
    route.ts          ← GET /api/tools/:id, PUT /api/tools/:id
```

---

## Route File Templates

### Collection Route (`route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/{resource}
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '50');

    const items = db.prepare(
      'SELECT * FROM {table} ORDER BY created_at DESC LIMIT ?'
    ).all(limit);

    return NextResponse.json({ items });   // 200 OK
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/{resource}
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { field1, field2 } = body;

    // Input validation
    if (!field1 || !field2) {
      return NextResponse.json(
        { error: 'field1 and field2 are required' },
        { status: 400 }
      );
    }

    const id = (await import('uuid')).v4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO {table} (id, field1, field2, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, field1, field2, now);

    const item = db.prepare('SELECT * FROM {table} WHERE id = ?').get(id);
    return NextResponse.json({ item }, { status: 201 });   // 201 Created
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

### Single Resource Route (`[id]/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/{resource}/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // Next.js 15+: Promise
) {
  try {
    const { id } = await params;                    // MUST await
    const db = getDb();

    const item = db.prepare('SELECT * FROM {table} WHERE id = ?').get(id);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/{resource}/:id (full update)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    const existing = db.prepare('SELECT * FROM {table} WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE {table} SET field1 = ?, updated_at = ? WHERE id = ?
    `).run(body.field1, new Date().toISOString(), id);

    const item = db.prepare('SELECT * FROM {table} WHERE id = ?').get(id);
    return NextResponse.json({ item });   // 200 OK
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/{resource}/:id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM {table} WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM {table} WHERE id = ?').run(id);
    return NextResponse.json({ message: 'Deleted' });   // 200 OK
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

---

## Core Rules

### 1. Error Response Format

```typescript
// MUST: always use this format
return NextResponse.json({ error: String(e) }, { status: 500 });
return NextResponse.json({ error: 'Not found' }, { status: 404 });
return NextResponse.json({ error: 'field is required' }, { status: 400 });

// NEVER: do not use other formats
return NextResponse.json({ message: 'error occurred' }, { status: 500 });
```

### 2. HTTP Status Codes

| Situation | Code |
|-----------|------|
| GET success | 200 |
| PUT/PATCH success | 200 |
| POST creation success | 201 |
| Resource not found | 404 |
| Input validation failure | 400 |
| Server error | 500 |

### 3. Dynamic Parameters (Next.js 15+)

```typescript
// MUST: await params
const { id } = await params;

// NEVER: destructure without await
const { id } = params;  // ← TypeError
```

### 4. Async Operations (fire-and-forget)

```typescript
// MUST: do not await runJob
runJob(jobId).catch(e => console.error('Job run error:', e));
return NextResponse.json({ jobId });   // respond immediately

// NEVER: awaiting long async operations causes HTTP timeout
await runJob(jobId);   // ← timeout risk
```

### 5. DB Access

```typescript
// MUST: use getDb()
const db = getDb();
const items = db.prepare('SELECT ...').all();

// NEVER: direct instantiation
import Database from 'better-sqlite3';
const db = new Database('data/luminary.db');   // ← forbidden
```

### 6. JSON Column Handling

```typescript
// When writing to DB
db.prepare('INSERT INTO skills (..., tools, ...) VALUES (?, ?, ?)').run(
  ...,
  JSON.stringify(tools || []),   // MUST stringify
  ...
);

// When reading from DB — returns raw string
const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
// skill.tools is a string like '["summarize","remember"]'
const toolList = JSON.parse(skill.tools);   // MUST parse
```

---

## Existing Routes Reference

| Route | File | Notes |
|-------|------|-------|
| POST /api/chat | `app/api/chat/route.ts` | Uses Input Adapter |
| GET/POST /api/jobs | `app/api/jobs/route.ts` | `runNow` option for immediate execution |
| GET/PATCH /api/jobs/:id | `app/api/jobs/[id]/route.ts` | `action: 'run' \| 'cancel'` |
| GET/POST /api/skills | `app/api/skills/route.ts` | JSON column serialization example |
| GET/PUT/DELETE /api/skills/:id | `app/api/skills/[id]/route.ts` | COALESCE partial update pattern |
| GET /api/memory | `app/api/memory/route.ts` | lib function wrapping pattern |
| GET/POST /api/schedules | `app/api/schedules/route.ts` | FK validation pattern |
| POST /api/maintenance | `app/api/maintenance/route.ts` | Simple loop trigger pattern |

---

## Using Input Adapter (Optional)

For complex input validation like chat, add a parser to `lib/adapters/input/web.ts` and call it from the route.

```typescript
// Add to lib/adapters/input/web.ts
export interface MyInputMessage {
  field1: string;
  field2?: number;
}

export function parseMyInput(body: unknown): MyInputMessage {
  if (typeof body !== 'object' || body === null) throw new Error('Invalid input');
  const b = body as Record<string, unknown>;
  if (!b.field1 || typeof b.field1 !== 'string') throw new Error('field1 required');
  return {
    field1: b.field1,
    field2: typeof b.field2 === 'number' ? b.field2 : undefined,
  };
}
```

For simple cases, parsing directly in the route is fine.
