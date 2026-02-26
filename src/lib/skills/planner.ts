// src/lib/skills/planner.ts
import { getClient } from '../llm/client';
import type { LLMClient } from '../llm/types';
import { listTools } from '../tools/registry';

export interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export interface Plan {
  success: boolean;
  steps: ToolCall[];
  reasoning: string;
}

export async function planSkill(
  skillName: string,
  skillGoal: string,
  skillTools: string[],
  jobInput: Record<string, unknown>
): Promise<Plan> {
  let llm: LLMClient;
  try {
    llm = getClient();
  } catch (e) {
    return { success: false, steps: [], reasoning: `LLM not configured: ${String(e)}` };
  }

  // If no specific tools are specified, allow all registered tools
  const availableTools = listTools().filter(t =>
    skillTools.length === 0 || skillTools.includes(t.name)
  );

  const toolDescriptions = availableTools.map(t =>
    `- ${t.name}: ${t.description}`
  ).join('\n');

  const systemPrompt = `You are a task planner. Given a skill name, goal, and available tools, create a step-by-step execution plan.

Available tools:
${toolDescriptions}

Respond with ONLY a valid JSON object — no markdown, no explanation:
{"reasoning": "<brief explanation>", "steps": [{"toolName": "web_search", "input": {"query": "example search"}}]}`;

  try {
    const response = await llm.complete({
      system: systemPrompt,
      messages: [{ role: 'user', content: `Skill: ${skillName}\nGoal: ${skillGoal}\nInput: ${JSON.stringify(jobInput)}` }],
      tools: [],
      maxTokens: 2000,
    });

    if (response.type !== 'text') {
      return { success: false, steps: [], reasoning: 'Unexpected tool_call response from planner LLM' };
    }

    // Strip possible markdown code fences (``` or ```json)
    const raw = response.text.trim();
    const jsonStr = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const result = JSON.parse(jsonStr) as { steps?: ToolCall[]; reasoning?: string };
    const steps = Array.isArray(result.steps) ? result.steps : [];
    return {
      success: steps.length > 0,
      steps,
      reasoning: result.reasoning || '',
    };
  } catch (e) {
    console.error('Planner error:', e);
    return { success: false, steps: [], reasoning: `Error: ${String(e)}` };
  }
}
