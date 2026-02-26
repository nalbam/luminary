import { pruneExpired, getNotes, writeNote } from '../memory/notes';
import { getDb } from '../db';
import type { MemoryNote } from '../memory/notes';

async function smartMerge(notes: MemoryNote[]): Promise<boolean> {
  if (notes.length < 2) return false;
  const ids = notes.map(n => n.id);
  const combined = notes.map(n => n.content).join('\n\n---\n\n');

  let mergedContent = combined;

  // Attempt LLM-based summarization when available
  try {
    const { getClient } = await import('../llm/client');
    const llm = getClient();
    const response = await llm.complete({
      system: 'You are a memory consolidator. Synthesize the following notes into a concise summary that preserves all unique facts, learnings, and key details. Remove duplication. Output only the summary text, no headers or preamble.',
      messages: [{ role: 'user', content: combined }],
      tools: [],
      maxTokens: 500,
    });
    if (response.type === 'text' && response.text.trim()) {
      mergedContent = response.text.trim();
    }
  } catch {
    // Fall back to concatenation if LLM is unavailable
  }

  const userId = notes[0].userId;
  const merged = writeNote({
    kind: 'summary',
    content: mergedContent,
    userId,
    tags: [...new Set(notes.flatMap(n => n.tags))],
    stability: 'stable',
  });

  const db = getDb();
  const stmt = db.prepare('UPDATE memory_notes SET superseded_by = ? WHERE id = ?');
  for (const id of ids) {
    stmt.run(merged.id, id);
  }

  return true;
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

  // Find volatile notes older than 7 days and merge them, grouped by userId
  const volatileNotes = getNotes({ limit: 100 })
    .filter(n => n.stability === 'volatile' && !n.supersededBy);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const oldVolatile = volatileNotes.filter(n =>
    new Date(n.createdAt) < sevenDaysAgo
  );

  // Group by userId so notes from different users are never merged together.
  // Notes without a userId are skipped — they have no user context and should not be merged.
  const byUser = new Map<string, MemoryNote[]>();
  for (const note of oldVolatile) {
    if (!note.userId) continue;
    if (!byUser.has(note.userId)) byUser.set(note.userId, []);
    byUser.get(note.userId)!.push(note);
  }

  let merged = 0;
  for (const userNotes of byUser.values()) {
    if (userNotes.length < 3) continue;
    // Merge in batches of 5
    for (let i = 0; i < userNotes.length; i += 5) {
      const batch = userNotes.slice(i, i + 5);
      if (batch.length >= 2) {
        const ok = await smartMerge(batch);
        if (ok) merged++;
      }
    }
  }

  return {
    pruned,
    merged,
    message: `Maintenance complete: pruned ${pruned} notes, merged ${merged} batches`,
  };
}
