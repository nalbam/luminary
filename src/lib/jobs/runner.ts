import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getTool } from '../tools/registry';
import { planSkill } from '../skills/planner';
import { writeNote } from '../memory/notes';

// Ensure tools are registered
import '../tools/summarize';
import '../tools/remember';
import '../tools/search';
import '../tools/list_memory';

export async function enqueueJob(
  skillId: string | null,
  triggerType: string,
  input: Record<string, unknown>,
  userId?: string
): Promise<string> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO jobs (id, skill_id, trigger_type, status, input, user_id, created_at)
    VALUES (?, ?, ?, 'queued', ?, ?, ?)
  `).run(id, skillId || null, triggerType, JSON.stringify(input), userId || 'user_default', now);

  return id;
}

export async function runJob(jobId: string): Promise<void> {
  const db = getDb();

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
  if (!job) throw new Error(`Job ${jobId} not found`);

  // Mark as running
  db.prepare('UPDATE jobs SET status = ?, started_at = ? WHERE id = ?')
    .run('running', new Date().toISOString(), jobId);

  try {
    const input = JSON.parse((job.input as string) || '{}');
    const userId = (job.user_id as string) || 'user_default';
    let result: unknown;

    if (job.skill_id) {
      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(job.skill_id as string) as Record<string, unknown> | undefined;
      if (!skill) throw new Error(`Skill ${job.skill_id} not found`);

      const tools = JSON.parse((skill.tools as string) || '[]');
      const plan = await planSkill(
        skill.name as string,
        skill.goal as string,
        tools,
        input
      );

      const stepResults: unknown[] = [];
      for (const step of plan.steps) {
        const stepId = uuidv4();
        const stepStart = new Date().toISOString();

        db.prepare(`
          INSERT INTO step_runs (id, job_id, tool_name, input, started_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(stepId, jobId, step.toolName, JSON.stringify(step.input), stepStart);

        const tool = getTool(step.toolName);
        if (!tool) {
          const errMsg = `Tool "${step.toolName}" not found`;
          db.prepare('UPDATE step_runs SET error = ?, completed_at = ? WHERE id = ?')
            .run(errMsg, new Date().toISOString(), stepId);
          stepResults.push({ error: errMsg });
          continue;
        }

        try {
          const toolResult = await tool.run(step.input, { userId, jobId });
          db.prepare('UPDATE step_runs SET output = ?, artifact_path = ?, completed_at = ? WHERE id = ?')
            .run(
              JSON.stringify(toolResult.output),
              toolResult.artifactPath || null,
              new Date().toISOString(),
              stepId
            );
          stepResults.push(toolResult.output);
        } catch (e) {
          const errMsg = String(e);
          db.prepare('UPDATE step_runs SET error = ?, completed_at = ? WHERE id = ?')
            .run(errMsg, new Date().toISOString(), stepId);
          stepResults.push({ error: errMsg });
        }
      }

      result = { plan: plan.reasoning, steps: stepResults };

      // Write summary note
      writeNote({
        kind: 'summary',
        content: `Completed job for skill "${skill.name}": ${plan.reasoning}`,
        userId,
        jobId,
        stability: 'volatile',
        ttlDays: 7,
      });
    } else {
      result = { message: 'Job completed (no skill)' };
    }

    db.prepare('UPDATE jobs SET status = ?, result = ?, completed_at = ? WHERE id = ?')
      .run('succeeded', JSON.stringify(result), new Date().toISOString(), jobId);
  } catch (e) {
    const errMsg = String(e);
    console.error(`Job ${jobId} failed:`, e);
    db.prepare('UPDATE jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?')
      .run('failed', errMsg, new Date().toISOString(), jobId);
  }
}
