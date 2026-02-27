// src/lib/agent/loop.ts
import { getClient } from '../llm/client';
import { buildAgentContext } from './context';
import { ensureIdentityExists } from './soul';
import { getAgentTools, executeAgentTool } from './tools';
import {
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage,
  saveAssistantToolCalls,
  saveToolResults,
} from '../memory/conversations';
import { appendEvent } from '../events/store';
import { writeNote } from '../memory/notes';
import type { ConversationMessage } from '../llm/types';

const MAX_ITERATIONS = 10;
const MAX_LLM_RETRIES = 3;

/** Returns true for errors that are worth retrying (rate limit, server overload, network). */
function isRetryable(e: unknown): boolean {
  const msg = String(e).toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('529') ||
    msg.includes('overload') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused')
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runAgentLoop(
  message: string,
  userId = 'user_default'
): Promise<{ response: string }> {
  // Identity 초기화 (agent, soul, user 노트 없으면 생성)
  ensureIdentityExists(userId);

  let llm;
  try {
    llm = getClient();
  } catch (e) {
    return { response: `LLM not configured: ${String(e)}` };
  }

  // 이벤트 기록
  appendEvent({ type: 'user_message', userId, payload: { message } });

  // 히스토리에 저장 + 로드
  saveUserMessage(userId, message);
  const history: ConversationMessage[] = getConversationHistory(userId);

  // 컨텍스트 + 도구 (현재 메시지 기반 시맨틱 검색 포함)
  const rawSystemPrompt = await buildAgentContext(userId, message);
  const systemPrompt = rawSystemPrompt ||
    'You are a proactive personal AI assistant. Be concise, direct, and helpful.';
  const tools = getAgentTools();

  // Agentic loop
  let iterations = 0;
  const executedTools: string[] = []; // Track tool calls for auto-summary
  const executedToolResults: string[] = []; // Track key results for richer reflection (Step 7)

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    let response;
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_LLM_RETRIES; attempt++) {
      try {
        response = await llm.complete({ system: systemPrompt, messages: history, tools });
        lastError = undefined;
        break;
      } catch (e) {
        lastError = e;
        if (attempt < MAX_LLM_RETRIES && isRetryable(e)) {
          const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.warn(`LLM error (attempt ${attempt}/${MAX_LLM_RETRIES}), retrying in ${delayMs}ms:`, String(e));
          await sleep(delayMs);
        } else {
          break;
        }
      }
    }
    if (lastError !== undefined || !response) {
      const errMsg = `LLM error: ${String(lastError)}`;
      console.error(errMsg);
      return { response: errMsg };
    }

    if (response.type === 'text') {
      saveAssistantMessage(userId, response.text);
      appendEvent({ type: 'assistant_message', userId, payload: { message: response.text } });

      // Auto-summary (Step 7: Reflect & Remember): if 1+ tools were executed,
      // write a summary note automatically. This enforces the Remember philosophy
      // without relying on LLM discretion.
      if (executedTools.length >= 1) {
        const toolSummary = executedTools.join(' → ');
        const resultContext = executedToolResults.length > 0
          ? `\nKey results:\n${executedToolResults.join('\n')}`
          : '';
        writeNote({
          kind: 'summary',
          content: `[Auto-Reflect] Task: "${message.slice(0, 200)}"\nTools used (${executedTools.length}): ${toolSummary}${resultContext}\nOutcome: ${response.text.slice(0, 800)}`,
          userId,
          stability: 'volatile',
          ttlDays: 7,
        });
      }

      return { response: response.text };
    }

    if (response.type === 'tool_calls') {
      // Guard: LLM returned tool_calls with empty array — no progress possible
      if (response.toolCalls.length === 0) {
        const fallback = 'Task complete.';
        saveAssistantMessage(userId, fallback);
        return { response: fallback };
      }

      saveAssistantToolCalls(userId, response.toolCalls);
      history.push({ role: 'assistant_tool_calls', toolCalls: response.toolCalls });

      const toolResults = [];
      for (const call of response.toolCalls) {
        let result: unknown;
        try {
          result = await executeAgentTool(call.name, call.input, { userId });
        } catch (e) {
          result = { error: String(e) };
        }
        // Track tools for auto-summary (exclude memory/soul tools to avoid redundancy)
        const skipForSummary = new Set(['remember', 'update_memory', 'update_soul', 'list_memory']);
        if (!skipForSummary.has(call.name)) {
          executedTools.push(call.name);
          // Capture a brief result snippet for richer Step 7 reflection
          const raw = JSON.stringify(result);
          executedToolResults.push(`${call.name}: ${raw.length > 200 ? raw.slice(0, 200) + '...' : raw}`);
        }
        toolResults.push({ toolUseId: call.id, content: JSON.stringify(result) });
      }

      saveToolResults(userId, toolResults);
      history.push({ role: 'tool_results', results: toolResults });
    }
  }

  const fallback = 'I reached the maximum number of reasoning steps. Please try again.';
  saveAssistantMessage(userId, fallback);
  return { response: fallback };
}
