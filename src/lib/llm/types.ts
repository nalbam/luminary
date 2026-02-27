// src/lib/llm/types.ts

export interface LLMTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMToolResult {
  toolUseId: string;
  content: string; // JSON.stringify result
}

// Provider-agnostic internal message format
export type ConversationMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'assistant_tool_calls'; toolCalls: LLMToolCall[] }
  | { role: 'tool_results'; results: LLMToolResult[] };

export type LLMResponse =
  | { type: 'text'; text: string }
  | { type: 'tool_calls'; toolCalls: LLMToolCall[] };

export interface LLMClient {
  complete(params: {
    system: string;
    messages: ConversationMessage[];
    tools: LLMTool[];
    maxTokens?: number;
  }): Promise<LLMResponse>;
}
