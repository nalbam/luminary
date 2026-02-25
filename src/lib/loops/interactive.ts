import OpenAI from 'openai';
import { buildContextPack } from '../memory/context-pack';
import { appendEvent } from '../events/store';
import { writeNote } from '../memory/notes';

export async function handleUserMessage(
  message: string,
  userId: string = 'user_default',
  _threadId?: string
): Promise<{ response: string; jobId?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      response: 'OPENAI_API_KEY is not configured. Please set it in your environment variables to use the AI assistant.',
    };
  }

  // Log the incoming event
  appendEvent({
    type: 'user_message',
    userId,
    payload: { message, threadId: _threadId },
  });

  // Build context pack
  const contextPack = buildContextPack(userId, message);

  const systemPrompt = `You are vibemon-agent, a proactive personal AI assistant. You help users by answering questions, running tasks, and remembering important information.

${contextPack.formattedText}

Be helpful, concise, and proactive. If the user asks you to remember something, acknowledge it. If they ask about your capabilities, explain that you can run skills (automated tasks), manage jobs, and maintain memory across conversations.`;

  try {
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || 'No response generated.';

    // Log the assistant response
    appendEvent({
      type: 'assistant_message',
      userId,
      payload: { message: response },
    });

    // Write a log note for significant interactions
    if (message.toLowerCase().includes('remember') || message.toLowerCase().includes('note')) {
      writeNote({
        kind: 'log',
        content: `User asked: ${message}\nAssistant responded: ${response}`,
        userId,
        stability: 'volatile',
        ttlDays: 30,
      });
    }

    return { response };
  } catch (e: unknown) {
    const errMsg = `Error calling OpenAI: ${String(e)}`;
    console.error(errMsg);
    return { response: errMsg };
  }
}
