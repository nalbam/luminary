// src/lib/loops/interactive.ts
import { runAgentLoop } from '../agent/loop';

export async function handleUserMessage(
  message: string,
  userId = 'user_default',
  _threadId?: string
): Promise<{ response: string; jobId?: string }> {
  return runAgentLoop(message, userId);
}
