import { pruneExpired, getNotes, mergeNotes } from '../memory/notes';

export async function runMaintenance(): Promise<{
  pruned: number;
  merged: number;
  message: string;
}> {
  console.log('Running maintenance...');

  // Prune expired notes
  const pruned = pruneExpired();
  console.log(`Pruned ${pruned} expired notes`);

  // Find volatile notes older than 7 days and merge them
  const volatileNotes = getNotes({ limit: 100 })
    .filter(n => n.stability === 'volatile' && !n.supersededBy);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const oldVolatile = volatileNotes.filter(n => 
    new Date(n.createdAt) < sevenDaysAgo
  );

  let merged = 0;
  if (oldVolatile.length >= 3) {
    // Merge in batches of 5
    for (let i = 0; i < oldVolatile.length; i += 5) {
      const batch = oldVolatile.slice(i, i + 5);
      if (batch.length >= 2) {
        const mergedNote = mergeNotes(batch.map(n => n.id));
        if (mergedNote) merged++;
      }
    }
  }

  return {
    pruned,
    merged,
    message: `Maintenance complete: pruned ${pruned} notes, merged ${merged} batches`,
  };
}
