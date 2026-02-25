import OpenAI from 'openai';
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { steps: [], reasoning: 'OPENAI_API_KEY not set' };
  }

  const availableTools = listTools().filter(t => 
    skillTools.length === 0 || skillTools.includes(t.name)
  );

  const toolDescriptions = availableTools.map(t => 
    `- ${t.name}: ${t.description}`
  ).join('\n');

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a task planner. Given a skill and available tools, create a plan as a JSON object.
Available tools:
${toolDescriptions}

Respond with JSON in this format:
{
  "reasoning": "explanation of the plan",
  "steps": [
    {"toolName": "tool_name", "input": {"key": "value"}}
  ]
}`,
        },
        {
          role: 'user',
          content: `Skill: ${skillName}\nGoal: ${skillGoal}\nInput: ${JSON.stringify(jobInput)}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return {
      steps: result.steps || [],
      reasoning: result.reasoning || '',
    };
  } catch (e) {
    console.error('Planner error:', e);
    return { steps: [], reasoning: `Error: ${String(e)}` };
  }
}
