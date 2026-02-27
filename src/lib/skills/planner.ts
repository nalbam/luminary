// src/lib/skills/planner.ts
import os from 'os';
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

export async function planRoutine(
  routineName: string,
  routineGoal: string,
  routineTools: string[],
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
    routineTools.length === 0 || routineTools.includes(t.name)
  );

  const toolDescriptions = availableTools.map(t =>
    `- ${t.name}: ${t.description}`
  ).join('\n');

  const platform = os.platform(); // 'darwin' | 'linux' | 'win32' ...
  const platformHint = platform === 'darwin'
    ? 'macOS/Darwin: use vm_stat (not free), top -l 1 (not top), ps aux, sysctl -n hw.memsize. Commands like free/htop do NOT exist on macOS.'
    : platform === 'linux'
    ? 'Linux: use free -m, top -bn1, ps aux, cat /proc/meminfo, cat /proc/cpuinfo.'
    : `Platform: ${platform}. Use platform-appropriate commands.`;

  const systemPrompt = `You are a task planner. Given a routine name, goal, and available tools, create a step-by-step execution plan.

Available tools:
${toolDescriptions}

System info: platform=${platform}, arch=${os.arch()}
${platformHint}

Rules:
- You MUST only use tool names from the list above. Never invent new tool names.
- IMPORTANT: This routine is called ONCE when triggered. Recurring scheduling is handled externally (the scheduler fires this routine repeatedly). Do NOT try to set up timers, cron, or recurring logic inside the plan.
- For run_bash: commands must complete within 30 seconds. Use quick one-liner commands. Never use sleep, cron, or commands that block.
- Keep plans simple: 1-3 steps maximum. Prefer direct tool calls over multi-step pipelines.
- When the goal contains "notify", "alert", "send", "tell", "let me know": MUST use notify tool to deliver the message. Do NOT use remember for notifications.
- Define exit criteria in reasoning: what does "done" look like for THIS SINGLE execution of the routine?

Respond with ONLY a valid JSON object — no markdown, no explanation:
{"reasoning": "<exit criteria + brief explanation>", "steps": [{"toolName": "web_search", "input": {"query": "example search"}}]}`;

  try {
    const response = await llm.complete({
      system: systemPrompt,
      messages: [{ role: 'user', content: `Routine: ${routineName}\nGoal: ${routineGoal}\nInput: ${JSON.stringify(jobInput)}` }],
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

    // Attempt to parse; on failure, log the raw LLM output for debugging.
    let result: { steps?: ToolCall[]; reasoning?: string };
    try {
      result = JSON.parse(jsonStr) as { steps?: ToolCall[]; reasoning?: string };
    } catch (parseErr) {
      console.error('Planner JSON parse error. Raw LLM output:', jsonStr.slice(0, 500));
      return { success: false, steps: [], reasoning: `Planner returned invalid JSON: ${String(parseErr)}` };
    }
    const rawSteps = Array.isArray(result.steps) ? result.steps : [];

    // Validate that each step references a tool that actually exists in the registry.
    // The LLM sometimes hallucinates tool names (e.g. "use_top_command") that look
    // plausible but are not registered. Catching this here prevents ghost step_runs.
    const availableToolNames = new Set(availableTools.map(t => t.name));
    const unknownTools = rawSteps
      .map(s => s.toolName)
      .filter(name => !availableToolNames.has(name));

    if (unknownTools.length > 0) {
      return {
        success: false,
        steps: [],
        reasoning: `Plan contains unregistered tools: ${unknownTools.join(', ')}. Available: ${[...availableToolNames].join(', ')}`,
      };
    }

    return {
      success: rawSteps.length > 0,
      steps: rawSteps,
      reasoning: result.reasoning || '',
    };
  } catch (e) {
    console.error('Planner error:', e);
    return { success: false, steps: [], reasoning: `Error: ${String(e)}` };
  }
}

/** @deprecated Use planRoutine instead */
export const planSkill = planRoutine;
