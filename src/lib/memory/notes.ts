import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface MemoryNote {
  id: string;
  kind: 'log' | 'summary' | 'rule' | 'soul';
  content: string;
  scope: string;
  userId?: string;
  tags: string[];
  confidence: number;
  stability: 'volatile' | 'stable' | 'permanent';
  ttlDays?: number;
  expiresAt?: string;
  sensitivity: 'normal' | 'sensitive';
  evidence: string[];
  jobId?: string;
  supersededBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface WriteNoteInput {
  kind: 'log' | 'summary' | 'rule' | 'soul';
  content: string;
  scope?: string;
  userId?: string;
  tags?: string[];
  confidence?: number;
  stability?: 'volatile' | 'stable' | 'permanent';
  ttlDays?: number;
  sensitivity?: 'normal' | 'sensitive';
  evidence?: string[];
  jobId?: string;
}

interface GetNotesFilter {
  userId?: string;
  kind?: 'log' | 'summary' | 'rule' | 'soul';
  scope?: string;
  tags?: string[];
  limit?: number;
}

export function writeNote(input: WriteNoteInput): MemoryNote {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();
  
  let expiresAt: string | null = null;
  if (input.ttlDays) {
    const exp = new Date();
    exp.setDate(exp.getDate() + input.ttlDays);
    expiresAt = exp.toISOString();
  }

  db.prepare(`
    INSERT INTO memory_notes (id, kind, content, scope, user_id, tags, confidence, stability, ttl_days, expires_at, sensitivity, evidence, job_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.kind,
    input.content,
    input.scope || 'user',
    input.userId || null,
    JSON.stringify(input.tags || []),
    input.confidence ?? 1.0,
    input.stability || 'stable',
    input.ttlDays || null,
    expiresAt,
    input.sensitivity || 'normal',
    JSON.stringify(input.evidence || []),
    input.jobId || null,
    now,
    now,
  );

  return getNoteById(id)!;
}

export function getNoteById(id: string): MemoryNote | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM memory_notes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToNote(row);
}

export function getNotes(filter: GetNotesFilter = {}): MemoryNote[] {
  const db = getDb();
  const conditions: string[] = ["(expires_at IS NULL OR expires_at > datetime('now'))"];
  const params: unknown[] = [];

  if (filter.userId) {
    conditions.push('user_id = ?');
    params.push(filter.userId);
  }
  if (filter.kind) {
    conditions.push('kind = ?');
    params.push(filter.kind);
  }
  if (filter.scope) {
    conditions.push('scope = ?');
    params.push(filter.scope);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filter.limit || 50;
  const rows = db.prepare(`SELECT * FROM memory_notes ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, limit) as Record<string, unknown>[];

  let notes = rows.map(rowToNote);

  if (filter.tags && filter.tags.length > 0) {
    notes = notes.filter(note =>
      filter.tags!.some(tag => note.tags.includes(tag))
    );
  }

  return notes;
}

export function pruneExpired(): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM memory_notes WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')").run();
  return result.changes;
}

export function mergeNotes(ids: string[]): MemoryNote | null {
  if (ids.length < 2) return null;
  const notes = ids.map(id => getNoteById(id)).filter(Boolean) as MemoryNote[];
  if (notes.length < 2) return null;

  const merged = writeNote({
    kind: 'summary',
    content: notes.map(n => n.content).join('\n\n'),
    userId: notes[0].userId,
    tags: [...new Set(notes.flatMap(n => n.tags))],
    stability: 'stable',
  });

  const db = getDb();
  const stmt = db.prepare('UPDATE memory_notes SET superseded_by = ? WHERE id = ?');
  for (const id of ids) {
    stmt.run(merged.id, id);
  }

  return merged;
}

function rowToNote(row: Record<string, unknown>): MemoryNote {
  return {
    id: row.id as string,
    kind: row.kind as 'log' | 'summary' | 'rule' | 'soul',
    content: row.content as string,
    scope: (row.scope as string) || 'user',
    userId: row.user_id as string | undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
    confidence: (row.confidence as number) ?? 1.0,
    stability: (row.stability as 'volatile' | 'stable' | 'permanent') || 'stable',
    ttlDays: row.ttl_days as number | undefined,
    expiresAt: row.expires_at as string | undefined,
    sensitivity: (row.sensitivity as 'normal' | 'sensitive') || 'normal',
    evidence: JSON.parse((row.evidence as string) || '[]'),
    jobId: row.job_id as string | undefined,
    supersededBy: row.superseded_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
