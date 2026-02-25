// src/lib/llm/openai.ts
import OpenAI from 'openai';
import type { LLMClient, LLMTool, LLMToolCall, LLMResponse, ConversationMessage } from './types';

export class OpenAIClient implements LLMClient {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(params: {
    system: string;
    messages: ConversationMessage[];
    tools: LLMTool[];
    maxTokens?: number;
  }): Promise<LLMResponse> {
    try {
      const oaiMessages = toOpenAIMessages(params.messages);
      const oaiTools = params.tools.map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: params.system },
          ...oaiMessages,
        ],
        tools: oaiTools.length > 0 ? oaiTools : undefined,
        max_tokens: params.maxTokens || 2000,
      });

      const choice = response.choices[0];
      if (!choice?.message) {
        throw new Error('OpenAI returned empty response: no choices available');
      }

      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCalls: LLMToolCall[] = choice.message.tool_calls
          .filter(tc => tc.type === 'function')
          .map(tc => {
            const fnCall = tc as OpenAI.ChatCompletionMessageFunctionToolCall;
            return {
              id: fnCall.id,
              name: fnCall.function.name,
              input: safeParseArgs(fnCall.function.arguments),
            };
          });
        return { type: 'tool_calls', toolCalls };
      }

      return { type: 'text', text: choice.message.content || '' };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('OpenAI')) throw error;
      throw new Error(`OpenAI API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error('Failed to parse tool call arguments:', raw);
    return { _raw: raw };
  }
}

function toOpenAIMessages(messages: ConversationMessage[]): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'assistant_tool_calls') {
      result.push({
        role: 'assistant',
        content: null,
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        })),
      });
    } else if (msg.role === 'tool_results') {
      for (const r of msg.results) {
        result.push({
          role: 'tool',
          tool_call_id: r.toolUseId,
          content: r.content,
        });
      }
    }
  }

  return result;
}
