// src/lib/skills/planner.ts
import { getClient } from '../llm/client';
import { listTools } from '../tools/registry';

export interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export interface Plan {
  steps: ToolCall[];
  reasoning: string;
}

export async function planSkill(
  skillName: string,
  skillGoal: string,
  skillTools: string[],
  jobInput: Record<string, unknown>
): Promise<Plan> {
  let llm;
  try {
    llm = getClient();
  } catch (e) {
    return { steps: [], reasoning: `LLM not configured: ${String(e)}` };
  }

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
{"reasoning": "<brief explanation>", "steps": [{"toolName": "<tool>", "input": {<key>: <value>}}]}`;

  try {
    const response = await llm.complete({
      system: systemPrompt,
      messages: [{ role: 'user', content: `Skill: ${skillName}\nGoal: ${skillGoal}\nInput: ${JSON.stringify(jobInput)}` }],
      tools: [],
      maxTokens: 1000,
    });

    if (response.type !== 'text') {
      return { steps: [], reasoning: 'Unexpected tool_call response from planner LLM' };
    }

    // Strip possible markdown code fences (``` or ```json)
    const raw = response.text.trim();
    const jsonStr = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const result = JSON.parse(jsonStr) as { steps?: ToolCall[]; reasoning?: string };
    return {
      steps: Array.isArray(result.steps) ? result.steps : [],
      reasoning: result.reasoning || '',
    };
  } catch (e) {
    console.error('Planner error:', e);
    return { steps: [], reasoning: `Error: ${String(e)}` };
  }
}
