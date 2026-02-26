// src/lib/llm/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMClient,
  LLMTool,
  LLMToolCall,
  LLMResponse,
  ConversationMessage,
  LLMToolResult,
} from './types';

export class AnthropicClient implements LLMClient {
  private client: Anthropic;

  constructor(apiKey?: string) {
    // Session ingress tokens (sk-ant-si-*) use Bearer auth (Authorization header).
    // When no explicit key is given, the SDK reads ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN from env.
    if (!apiKey) {
      this.client = new Anthropic({});
    } else if (apiKey.startsWith('sk-ant-si-')) {
      this.client = new Anthropic({ authToken: apiKey, apiKey: undefined });
    } else {
      this.client = new Anthropic({ apiKey });
    }
  }

  async complete(params: {
    system: string;
    messages: ConversationMessage[];
    tools: LLMTool[];
    maxTokens?: number;
  }): Promise<LLMResponse> {
    try {
      const anthropicMessages = toAnthropicMessages(params.messages);
      const anthropicTools: Anthropic.Tool[] = params.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: {
          type: 'object' as const,
          ...Object.fromEntries(Object.entries(t.inputSchema).filter(([k]) => k !== 'type')),
        } as Anthropic.Tool['input_schema'],
      }));

      const response = await this.client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-6',
        system: params.system,
        messages: anthropicMessages,
        tools: anthropicTools.length > 0 ? anthropicTools : undefined,
        max_tokens: params.maxTokens || 2000,
      });

      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      if (toolUseBlocks.length > 0) {
        const toolCalls: LLMToolCall[] = (toolUseBlocks as Anthropic.ToolUseBlock[]).map(b => ({
          id: b.id,
          name: b.name,
          input: b.input as Record<string, unknown>,
        }));
        return { type: 'tool_calls', toolCalls };
      }

      const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined;
      return { type: 'text', text: textBlock?.text || '' };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Anthropic')) throw error;
      throw new Error(`Anthropic API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function toAnthropicMessages(messages: ConversationMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'user') {
      result.push({ role: 'user', content: msg.content });
      i++;
    } else if (msg.role === 'assistant') {
      result.push({ role: 'assistant', content: msg.content });
      i++;
    } else if (msg.role === 'assistant_tool_calls') {
      result.push({
        role: 'assistant',
        content: msg.toolCalls.map(tc => ({
          type: 'tool_use' as const,
          id: tc.id,
          name: tc.name,
          input: tc.input,
        })),
      });
      // 바로 다음이 tool_results이면 user 메시지로 묶음
      if (i + 1 < messages.length && messages[i + 1].role === 'tool_results') {
        const tr = messages[i + 1] as { role: 'tool_results'; results: LLMToolResult[] };
        result.push({
          role: 'user',
          content: tr.results.map(r => ({
            type: 'tool_result' as const,
            tool_use_id: r.toolUseId,
            content: r.content,
          })),
        });
        i += 2;
      } else {
        i++;
      }
    } else {
      console.warn('Orphan tool_results message found at index', i, '- skipping');
      i++;
    }
  }

  return result;
}
