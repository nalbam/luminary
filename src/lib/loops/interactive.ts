// src/lib/loops/interactive.ts
import { runAgentLoop } from '../agent/loop';
import { ensureUserExists } from '../memory/users';

export async function handleUserMessage(
  message: string,
  userId = 'user_default',
  _threadId?: string
): Promise<{ response: string; jobId?: string }> {
  ensureUserExists(userId);
  return runAgentLoop(message, userId);
}
