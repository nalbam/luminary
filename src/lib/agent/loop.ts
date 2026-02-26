// src/lib/agent/loop.ts
import { getClient } from '../llm/client';
import { buildAgentContext } from './context';
import { ensureSoulExists } from './soul';
import { getAgentTools, executeAgentTool } from './tools';
import {
  getConversationHistory,
  saveUserMessage,
  saveAssistantMessage,
  saveAssistantToolCalls,
  saveToolResults,
} from '../memory/conversations';
import { appendEvent } from '../events/store';
import type { ConversationMessage } from '../llm/types';

const MAX_ITERATIONS = 10;

export async function runAgentLoop(
  message: string,
  userId = 'user_default'
): Promise<{ response: string }> {
  // Soul 초기화 (없으면 기본값 생성)
  ensureSoulExists(userId);

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

  // 컨텍스트 + 도구
  const rawSystemPrompt = buildAgentContext(userId);
  const systemPrompt = rawSystemPrompt ||
    'You are a proactive personal AI assistant. Be concise, direct, and helpful.';
  const tools = getAgentTools();

  // Agentic loop
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    let response;
    try {
      response = await llm.complete({ system: systemPrompt, messages: history, tools });
    } catch (e) {
      const errMsg = `LLM error: ${String(e)}`;
      console.error(errMsg);
      return { response: errMsg };
    }

    if (response.type === 'text') {
      saveAssistantMessage(userId, response.text);
      appendEvent({ type: 'assistant_message', userId, payload: { message: response.text } });
      return { response: response.text };
    }

    if (response.type === 'tool_calls') {
      saveAssistantToolCalls(userId, response.toolCalls);
      history.push({ role: 'assistant_tool_calls', toolCalls: response.toolCalls });

      const toolResults = await Promise.all(
        response.toolCalls.map(async (call) => {
          let result: unknown;
          try {
            result = await executeAgentTool(call.name, call.input, { userId });
          } catch (e) {
            result = { error: String(e) };
          }
          return { toolUseId: call.id, content: JSON.stringify(result) };
        })
      );

      saveToolResults(userId, toolResults);
      history.push({ role: 'tool_results', results: toolResults });
    }
  }

  const fallback = 'I reached the maximum number of reasoning steps. Please try again.';
  saveAssistantMessage(userId, fallback);
  return { response: fallback };
}
