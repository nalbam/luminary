// src/lib/agent/context.ts
import { getNotes } from '../memory/notes';
import { getUser } from '../memory/users';

/**
 * Builds the system prompt for the agentic loop.
 * Loads soul notes first (identity/principles), then user profile,
 * then rule notes (learned rules), then recent summary notes (context).
 * Called by runAgentLoop() in src/lib/agent/loop.ts.
 */
export function buildAgentContext(userId: string): string {
  const soulNotes = getNotes({ userId, kind: 'soul', limit: 5 });
  const ruleNotes = getNotes({ userId, kind: 'rule', limit: 10 })
    .filter(n => n.sensitivity !== 'sensitive');
  const summaryNotes = getNotes({ userId, kind: 'summary', limit: 5 })
    .filter(n => n.sensitivity !== 'sensitive');

  const parts: string[] = [];

  // Soul first: agent identity/principles
  if (soulNotes.length > 0) {
    parts.push(soulNotes.map(n => n.content).join('\n'));
  }

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

  // Rules: learned user rules
  if (ruleNotes.length > 0) {
    parts.push('## Rules\n' + ruleNotes.map(n => `- ${n.content}`).join('\n'));
  }

  // Recent context: recent work summaries
  if (summaryNotes.length > 0) {
    parts.push('## Recent Context\n' + summaryNotes.map(n => n.content).join('\n\n'));
  }

  return parts.join('\n\n');
}
