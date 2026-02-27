// src/lib/tools/notify.ts
// Notification tool — delivers messages to configured channels.
//
// Priority order:
//   1. Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
//   2. Slack    (SLACK_WEBHOOK_URL)
//   3. Memory fallback: writes a 'log' note visible in the Memory UI
//
// Use this tool whenever the user says "notify me", "send me", "let me know", etc.
import { registerTool } from './registry';
import { writeNote } from '../memory/notes';

export interface NotifyResult {
  channel: 'telegram' | 'slack' | 'memory';
  success: boolean;
  message: string;
  error?: string;
}

export async function sendNotification(
  message: string,
  userId = 'user_default'
): Promise<NotifyResult> {
  // 1. Telegram
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        }
      );
      if (res.ok) {
        return { channel: 'telegram', success: true, message };
      }
      const err = await res.text();
      console.warn('Telegram notification failed:', err);
    } catch (e) {
      console.warn('Telegram notification error:', String(e));
    }
  }

  // 2. Slack
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  if (slackWebhook) {
    try {
      const res = await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      if (res.ok) {
        return { channel: 'slack', success: true, message };
      }
      const err = await res.text();
      console.warn('Slack notification failed:', err);
    } catch (e) {
      console.warn('Slack notification error:', String(e));
    }
  }

  // 3. Memory fallback — visible in the Memory UI under "log" kind
  writeNote({
    kind: 'log',
    content: `[NOTIFICATION] ${message}`,
    userId,
    tags: ['notification'],
    stability: 'volatile',
    ttlDays: 3,
  });
  return { channel: 'memory', success: true, message };
}

registerTool({
  name: 'notify',
  description:
    'Send a notification message to the user. Use when asked to "notify me", "send me", "tell me when", etc. ' +
    'Supports {time} placeholder which is replaced with the current local time. ' +
    'Delivers via Telegram (if configured), Slack (if configured), or the Memory log as fallback.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Notification message. Use {time} to embed current time, e.g. "Current time: {time}"',
      },
    },
    required: ['message'],
  },
  async run(input, context) {
    try {
      // Resolve {time} placeholder with current KST time
      const raw = input.message as string;
      const message = raw.replace(/\{time\}/g, new Date().toLocaleString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
      const result = await sendNotification(message, context.userId
      );
      return { output: result };
    } catch (e) {
      return { output: null, error: String(e) };
    }
  },
});
