import { pruneExpired, getNotes, writeNote } from '../memory/notes';
import { getDb } from '../db';

/**
 * Synthesizes a batch of volatile notes into a single summary note using the LLM.
 * Falls back to naive concatenation if LLM is unavailable.
 */
async function synthesizeNotes(contents: string[]): Promise<string> {
  try {
    const { getClient } = await import('../llm/client');
    const llm = getClient();
    const response = await llm.complete({
      system: 'You are a memory synthesizer. Given a list of log/summary notes, extract the key insights, patterns, and facts into a single concise summary. Focus on what is reusable and actionable. Output only the synthesized summary text — no preamble.',
      messages: [{ role: 'user', content: contents.join('\n\n---\n\n') }],
      tools: [],
      maxTokens: 500,
    });
    if (response.type === 'text' && response.text.trim()) {
      return response.text.trim();
    }
  } catch {
    // LLM unavailable — fall through to concat
  }
  // Fallback: naive concatenation
  return contents.join('\n\n');
}

export async function runMaintenance(): Promise<{
  pruned: number;
  merged: number;
  message: string;
}> {
  console.log('Running maintenance...');

  // Prune expired notes
  const pruned = pruneExpired();
  console.log(`Pruned ${pruned} expired notes`);

  // Find volatile notes older than 7 days and synthesize them, grouped by userId
  const allVolatileNotes = getNotes({ limit: 200 })
    .filter(n => n.stability === 'volatile' && !n.supersededBy);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const oldVolatile = allVolatileNotes.filter(n =>
    new Date(n.createdAt) < sevenDaysAgo
  );

  // Group by userId so notes from different users are never mixed
  const notesByUser = new Map<string, typeof oldVolatile>();
  for (const note of oldVolatile) {
    const uid = note.userId || 'user_default';
    if (!notesByUser.has(uid)) notesByUser.set(uid, []);
    notesByUser.get(uid)!.push(note);
  }

  let merged = 0;
  const db = getDb();
  const stmt = db.prepare('UPDATE memory_notes SET superseded_by = ? WHERE id = ?');

  for (const [, userNotes] of notesByUser) {
    if (userNotes.length < 3) continue;

    // Synthesize in batches of 5
    for (let i = 0; i < userNotes.length; i += 5) {
      const batch = userNotes.slice(i, i + 5);
      if (batch.length < 2) continue;

      // Use LLM to synthesize contents into a meaningful summary
      const synthesized = await synthesizeNotes(batch.map(n => n.content));

      const mergedNote = writeNote({
        kind: 'summary',
        content: synthesized,
        userId: batch[0].userId,
        tags: [...new Set(batch.flatMap(n => n.tags))],
        stability: 'stable',
      });

      // Mark originals as superseded
      for (const note of batch) {
        stmt.run(mergedNote.id, note.id);
      }

      merged++;
    }
  }

  return {
    pruned,
    merged,
    message: `Maintenance complete: pruned ${pruned} notes, synthesized ${merged} batches`,
  };
}
