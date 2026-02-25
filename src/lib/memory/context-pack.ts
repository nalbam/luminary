import { getNotes } from './notes';

export interface ContextPack {
  notes: Array<{
    kind: string;
    content: string;
    tags: string[];
    createdAt: string;
  }>;
  formattedText: string;
}

export function buildContextPack(userId: string, _query?: string): ContextPack {
  const notes = getNotes({
    userId,
    limit: 20,
  }).filter(n => n.sensitivity !== 'sensitive' && !n.supersededBy);

  const formattedText = notes.length > 0
    ? `## Memory Context\n\n${notes.map(n => `[${n.kind}] ${n.content}`).join('\n\n')}`
    : '';

  return {
    notes: notes.map(n => ({
      kind: n.kind,
      content: n.content,
      tags: n.tags,
      createdAt: n.createdAt,
    })),
    formattedText,
  };
}
