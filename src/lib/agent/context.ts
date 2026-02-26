// src/lib/agent/context.ts
import os from 'os';
import { getNotes, getNoteById } from '../memory/notes';
import type { NoteKind, MemoryNote } from '../memory/notes';
import { getUser } from '../memory/users';

/**
 * Builds the system prompt for the agentic loop.
 *
 * Priority order:
 *   1. Soul notes (identity/principles)
 *   2. User profile (name, timezone, interests)
 *   3. Rule notes — semantically relevant to `message` if provided, else most recent
 *   4. Summary notes — semantically relevant to `message` if provided, else most recent
 *
 * When `message` is provided and OPENAI_API_KEY + sqlite-vec are available,
 * relevant notes are retrieved via vector similarity search so the agent sees
 * the RIGHT memories, not just the newest ones.
 */
export async function buildAgentContext(userId: string, message?: string): Promise<string> {
  const soulNotes = getNotes({ userId, kind: 'soul', limit: 5 });

  // Attempt semantic retrieval when a message is available
  let relevantNoteIds: Set<string> = new Set();
  if (message && process.env.OPENAI_API_KEY) {
    try {
      const { getEmbedding, searchSimilar } = await import('../memory/embeddings');
      const queryVec = await getEmbedding(message);
      const ids = await searchSimilar(queryVec, 15);
      relevantNoteIds = new Set(ids);
    } catch {
      // Embeddings unavailable — fall back to recency-based loading below
    }
  }

  // Load notes of a given kind: prefer semantically relevant, fill remainder with recent
  function loadRelevantNotes(
    kind: NoteKind,
    minCount: number,
    maxCount: number,
  ): MemoryNote[] {
    let notes: MemoryNote[] = relevantNoteIds.size > 0
      ? [...relevantNoteIds]
          .map(id => getNoteById(id))
          .filter((n): n is MemoryNote =>
            n !== null && n.kind === kind && !n.supersededBy &&
            n.userId === userId && n.sensitivity !== 'sensitive')
          .slice(0, maxCount)
      : [];

    if (notes.length < minCount) {
      const recent = getNotes({ userId, kind, limit: maxCount })
        .filter(n => n.sensitivity !== 'sensitive' && !relevantNoteIds.has(n.id));
      notes = [...notes, ...recent].slice(0, maxCount);
    }
    return notes;
  }

  const ruleNotes = loadRelevantNotes('rule', 5, 10);
  const summaryNotes = loadRelevantNotes('summary', 3, 5);

  const parts: string[] = [];

  // Soul first: agent identity/principles
  if (soulNotes.length > 0) {
    parts.push(soulNotes.map(n => n.content).join('\n'));
  }

  // System environment: always inject OS/platform so agent uses correct commands
  const platform = os.platform();
  const platformCommands = platform === 'darwin'
    ? 'macOS/Darwin: use vm_stat, top -l 1, ps aux, df -h, du -sh (NOT free/htop/--max-depth GNU opts)'
    : platform === 'linux'
    ? 'Linux: use free -m, top -bn1, ps aux, df -h, du -h --max-depth=1'
    : `Platform: ${platform}`;
  parts.push(`## System Environment\nOS: ${platform} (${os.arch()}), Node: ${process.version}\n${platformCommands}`);

  // User profile: who you are talking to
  const user = getUser(userId);
  if (user) {
    const name = user.preferredName || user.displayName;
    const lines: string[] = ['## User Profile', `Name: ${name}`];
    if (user.timezone && user.timezone !== 'UTC') {
      lines.push(`Timezone: ${user.timezone}`);
    }
    const interests = user.preferences.interests;
    if (interests && interests.length > 0) {
      lines.push(`Interests: ${interests.join(', ')}`);
    }
    parts.push(lines.join('\n'));
  }

  // Rules: learned user rules (relevance-prioritized)
  if (ruleNotes.length > 0) {
    parts.push('## Rules\n' + ruleNotes.map(n => `- ${n.content}`).join('\n'));
  }

  // Recent context: recent work summaries (relevance-prioritized)
  if (summaryNotes.length > 0) {
    parts.push('## Recent Context\n' + summaryNotes.map(n => n.content).join('\n\n'));
  }

  return parts.join('\n\n');
}
