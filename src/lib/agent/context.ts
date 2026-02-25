// src/lib/agent/context.ts
import { getNotes } from '../memory/notes';

export function buildAgentContext(userId: string): string {
  const soulNotes = getNotes({ userId, kind: 'soul', limit: 5 });
  const ruleNotes = getNotes({ userId, kind: 'rule', limit: 10 })
    .filter(n => n.sensitivity !== 'sensitive' && !n.supersededBy);
  const summaryNotes = getNotes({ userId, kind: 'summary', limit: 5 })
    .filter(n => n.sensitivity !== 'sensitive' && !n.supersededBy);

  const parts: string[] = [];

  // Soul first: 에이전트 정체성/행동 원칙
  if (soulNotes.length > 0) {
    parts.push(soulNotes.map(n => n.content).join('\n'));
  }

  // Rules: 학습된 사용자 규칙
  if (ruleNotes.length > 0) {
    parts.push('## Rules\n' + ruleNotes.map(n => `- ${n.content}`).join('\n'));
  }

  // Recent context: 최근 작업 요약
  if (summaryNotes.length > 0) {
    parts.push('## Recent Context\n' + summaryNotes.map(n => n.content).join('\n\n'));
  }

  return parts.join('\n\n');
}
