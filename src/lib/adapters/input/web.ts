export interface WebInputMessage {
  message: string;
  userId?: string;
  threadId?: string;
}

export function parseWebInput(body: unknown): WebInputMessage {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Invalid input: expected JSON object');
  }
  const b = body as Record<string, unknown>;
  if (!b.message || typeof b.message !== 'string') {
    throw new Error('Invalid input: message is required and must be a string');
  }
  return {
    message: b.message,
    userId: typeof b.userId === 'string' ? b.userId : 'user_default',
    threadId: typeof b.threadId === 'string' ? b.threadId : undefined,
  };
}
