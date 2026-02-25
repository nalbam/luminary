// src/lib/llm/client.ts
import type { LLMClient } from './types';
import { AnthropicClient } from './anthropic';
import { OpenAIClient } from './openai';

let _client: LLMClient | null = null;

const VALID_PROVIDERS = ['openai', 'anthropic'] as const;

export function getClient(): LLMClient {
  if (_client) return _client;

  const provider = process.env.LLM_PROVIDER?.toLowerCase();

  if (provider && !VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
    throw new Error(`Invalid LLM_PROVIDER: "${provider}". Valid values: openai, anthropic`);
  }

  if (
    provider === 'anthropic' ||
    (!provider && !process.env.OPENAI_API_KEY && process.env.ANTHROPIC_API_KEY)
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _client = new AnthropicClient(apiKey);
    return _client;
  }

  // Default: OpenAI
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY (or ANTHROPIC_API_KEY) is not set');
  _client = new OpenAIClient(apiKey);
  return _client;
}

// 테스트/핫스왑용 (env 변경 후 재초기화 필요 시)
export function resetClient(): void {
  _client = null;
}
