# Guide: Modify Schema

SQLite schema changes require modifying two places simultaneously. Modifying only one will result in different schemas being applied depending on the environment.

---

## Two Schema Sources

```
src/lib/db/
  schema.sql      ← Main schema file (read from filesystem)
  index.ts        ← Inline fallback schema (used when schema.sql is absent)
```

**getDb() logic:**
```typescript
const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);           // use schema.sql
} else {
  db.exec(`CREATE TABLE IF NOT EXISTS ...`);  // use inline fallback
}
```

> **MUST:** Modify **both** `schema.sql` and the inline schema in `index.ts`.

---

## Adding a New Table

### 1. Add to schema.sql

```sql
-- Add at the bottom of src/lib/db/schema.sql
-- my_new_table
CREATE TABLE IF NOT EXISTS my_new_table (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  data       TEXT DEFAULT '{}',     -- JSON column: DEFAULT '{}' or '[]'
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2. Also add to index.ts inline fallback

```typescript
// Add to the inline db.exec(`...`) block in src/lib/db/index.ts
CREATE TABLE IF NOT EXISTS my_new_table (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  data       TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 3. Define TypeScript types (optional)

Add an interface to the relevant lib file:

```typescript
// src/lib/my_new_table/index.ts (new file)
export interface MyNewItem {
  id: string;
  name: string;
  data: string;     // JSON string — requires JSON.parse when used
  createdAt: string;
}
```

---

## Adding a Column to Existing Table

SQLite supports `ADD COLUMN`, but `CREATE TABLE IF NOT EXISTS` does not add new columns to existing tables. **Already-created databases require migration.**

### Development Environment (when data/vibemon.db can be deleted)

1. Add the new column to both `schema.sql` and `index.ts` inline
2. Delete `data/vibemon.db`
3. Restart with `npm run dev` — DB is recreated with the new schema

```sql
-- Example of adding a column to schema.sql
CREATE TABLE IF NOT EXISTS skills (
  ...
  enabled        INTEGER DEFAULT 1,
  new_column     TEXT DEFAULT 'default_value',  -- ← new column
  created_at     TEXT DEFAULT (datetime('now')),
  ...
);
```

### Production Environment (when existing DB must be preserved)

Add migration logic to the `getDb()` function:

```typescript
// src/lib/db/index.ts
// Run migration after schema execution
db.exec(schema);

// Migration: add column to existing table
try {
  db.exec(`ALTER TABLE skills ADD COLUMN new_column TEXT DEFAULT 'default_value'`);
} catch {
  // Ignore if column already exists (SQLite doesn't support IF NOT EXISTS)
}
```

**Note:** SQLite `ALTER TABLE` only supports `ADD COLUMN`. Column deletion, type changes, and renaming are not supported.

---

## Column Constraints

### Adding CHECK Constraints

Existing data may violate new CHECK constraints. Apply only to new tables, or clean up existing data before applying.

```sql
-- New table: CHECK constraint is safe
CREATE TABLE IF NOT EXISTS my_table (
  kind TEXT CHECK (kind IN ('a', 'b', 'c'))
);

-- Adding CHECK to existing table: SQLite cannot add constraints via ALTER TABLE
-- → Recreate with new schema (migration required)
```

### JSON Column Conventions

Columns stored as JSON follow these conventions:

```sql
-- Object: DEFAULT '{}'
config TEXT DEFAULT '{}',

-- Array: DEFAULT '[]'
tags   TEXT DEFAULT '[]',
```

Always `JSON.parse()` when reading:
```typescript
const tags = JSON.parse(row.tags || '[]');  // guard against empty string
const config = JSON.parse(row.config || '{}');
```

---

## WAL Mode Considerations

`getDb()` sets `PRAGMA journal_mode = WAL` on DB initialization. When making schema changes in WAL mode:

- Schema changes (`CREATE TABLE`, `ALTER TABLE`) work normally in WAL mode.
- When deleting `data/vibemon.db`, also delete `data/vibemon.db-wal` and `data/vibemon.db-shm`.

```bash
# Delete all three files when resetting the DB
rm -f data/vibemon.db data/vibemon.db-wal data/vibemon.db-shm
```

---

## Checklist

Before modifying the schema:

- [ ] Modify `src/lib/db/schema.sql`
- [ ] Modify `src/lib/db/index.ts` inline fallback schema identically
- [ ] Add `DEFAULT '{}'` or `DEFAULT '[]'` for JSON columns
- [ ] Define new TypeScript interface (if needed)
- [ ] Check if migration is needed for existing DB
- [ ] Test DB recreation including WAL file deletion
