import { getDb } from '../db';

export async function storeEmbedding(noteId: string, vector: number[]): Promise<void> {
  const db = getDb();
  try {
    // Try to use sqlite-vec if available
    db.prepare('INSERT OR REPLACE INTO vec_notes(rowid, embedding) VALUES (?, ?)').run(
      noteId,
      Buffer.from(new Float32Array(vector).buffer)
    );
  } catch (e) {
    console.log('Vector storage not available:', e);
  }
}

export async function searchSimilar(_queryVector: number[], limit = 5): Promise<string[]> {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT rowid FROM vec_notes ORDER BY vec_distance_L2(embedding, ?) LIMIT ?').all(
      Buffer.from(new Float32Array(_queryVector).buffer),
      limit
    ) as Array<{ rowid: string }>;
    return rows.map(r => r.rowid);
  } catch (e) {
    console.log('Vector search not available:', e);
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
