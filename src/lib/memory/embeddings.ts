import { getDb } from '../db';

// Note: sqlite-vec's vec0 virtual table requires INTEGER rowids.
// We use a vec_note_map table to map integer rowids ↔ note UUIDs.

export async function storeEmbedding(noteId: string, vector: number[]): Promise<void> {
  const db = getDb();
  try {
    // Upsert into mapping table to get/create an integer rowid for this note
    db.prepare(
      `INSERT OR IGNORE INTO vec_note_map (note_id) VALUES (?)`
    ).run(noteId);
    const row = db.prepare(
      `SELECT rowid FROM vec_note_map WHERE note_id = ?`
    ).get(noteId) as { rowid: number } | undefined;
    if (!row) return;

    // Store the embedding using the integer rowid
    db.prepare(
      `INSERT OR REPLACE INTO vec_notes(rowid, embedding) VALUES (?, ?)`
    ).run(row.rowid, Buffer.from(new Float32Array(vector).buffer));
  } catch (e) {
    console.warn('storeEmbedding failed (sqlite-vec unavailable or error):', String(e));
  }
}

export async function searchSimilar(queryVector: number[], limit = 5): Promise<string[]> {
  const db = getDb();
  try {
    const rows = db.prepare(
      `SELECT rowid FROM vec_notes ORDER BY vec_distance_L2(embedding, ?) LIMIT ?`
    ).all(Buffer.from(new Float32Array(queryVector).buffer), limit) as Array<{ rowid: number }>;

    if (rows.length === 0) return [];

    // Resolve integer rowids back to note UUIDs
    const placeholders = rows.map(() => '?').join(',');
    const mapped = db.prepare(
      `SELECT note_id FROM vec_note_map WHERE rowid IN (${placeholders})`
    ).all(...rows.map(r => r.rowid)) as Array<{ note_id: string }>;

    return mapped.map(r => r.note_id);
  } catch (e) {
    console.warn('searchSimilar failed (sqlite-vec unavailable or error):', String(e));
    return [];
  }
}

export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}
