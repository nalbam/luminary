// src/lib/llm/client.ts
import type { LLMClient } from './types';

let _client: LLMClient | null = null;

export async function getClient(): Promise<LLMClient> {
  if (_client) return _client;

  const provider = process.env.LLM_PROVIDER?.toLowerCase();

  if (
    provider === 'anthropic' ||
    (!provider && !process.env.OPENAI_API_KEY && process.env.ANTHROPIC_API_KEY)
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    const { AnthropicClient } = await import('./anthropic');
    _client = new AnthropicClient(apiKey);
    return _client;
  }

  // Default: OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY (or ANTHROPIC_API_KEY) is not set');
  const { OpenAIClient } = await import('./openai');
  _client = new OpenAIClient(apiKey);
  return _client;
}

// 테스트/핫스왑용 (env 변경 후 재초기화 필요 시)
export function resetClient(): void {
  _client = null;
}
