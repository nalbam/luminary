import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getTool } from '../tools/registry';
import { planRoutine } from '../skills/planner';
import { writeNote } from '../memory/notes';

// Ensure tools are registered
import '../tools/summarize';
import '../tools/remember';
import '../tools/search';
import '../tools/list_memory';
import '../tools/bash';
import '../tools/fetch_url';
import '../tools/notify';

export async function enqueueJob(
  routineId: string | null,
  triggerType: string,
  input: Record<string, unknown>,
  userId?: string
): Promise<string> {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO jobs (id, routine_id, trigger_type, status, input, user_id, created_at)
    VALUES (?, ?, ?, 'queued', ?, ?, ?)
  `).run(id, routineId || null, triggerType, JSON.stringify(input), userId || 'user_default', now);

  return id;
}

export async function runJob(jobId: string): Promise<void> {
  const db = getDb();

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
  if (!job) throw new Error(`Job ${jobId} not found`);

  // Mark as running
  db.prepare('UPDATE jobs SET status = ?, started_at = ? WHERE id = ?')
    .run('running', new Date().toISOString(), jobId);

  let input: Record<string, unknown>;
  try {
    input = JSON.parse((job.input as string) || '{}');
  } catch (parseErr) {
    const errMsg = `Invalid job input JSON: ${String(parseErr)}`;
    console.error(`Job ${jobId} parse error:`, parseErr);
    db.prepare('UPDATE jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?')
      .run('failed', errMsg, new Date().toISOString(), jobId);
    return;
  }

  try {
    const userId = (job.user_id as string) || 'user_default';
    let result: unknown;

    if (job.routine_id) {
      // Routine-based execution (LLM-planned multi-step)
      const routine = db.prepare('SELECT * FROM routines WHERE id = ?').get(job.routine_id as string) as Record<string, unknown> | undefined;
      if (!routine) throw new Error(`Routine ${job.routine_id} not found`);

      const tools = JSON.parse((routine.tools as string) || '[]');
      const plan = await planRoutine(
        routine.name as string,
        routine.goal as string,
        tools,
        input
      );

      if (!plan.success) {
        throw new Error(`Routine planning failed for "${routine.name}": ${plan.reasoning}`);
      }

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
          throw new Error(`Tool "${step.toolName}" not found — cannot execute step`);
        }

        try {
          const toolResult = await tool.run(step.input, { userId, jobId });
          // Check tool-level error field (tool returned {output: null, error: "..."})
          if (toolResult.error) {
            const errMsg = `Tool "${step.toolName}" returned error: ${toolResult.error}`;
            db.prepare('UPDATE step_runs SET error = ?, completed_at = ? WHERE id = ?')
              .run(errMsg, new Date().toISOString(), stepId);
            stepResults.push({ error: errMsg });
          } else {
            db.prepare('UPDATE step_runs SET output = ?, artifact_path = ?, completed_at = ? WHERE id = ?')
              .run(
                JSON.stringify(toolResult.output),
                toolResult.artifactPath || null,
                new Date().toISOString(),
                stepId
              );
            stepResults.push(toolResult.output);
          }
        } catch (e) {
          const errMsg = String(e);
          db.prepare('UPDATE step_runs SET error = ?, completed_at = ? WHERE id = ?')
            .run(errMsg, new Date().toISOString(), stepId);
          stepResults.push({ error: errMsg });
        }
      }

      result = { plan: plan.reasoning, steps: stepResults };

      // If every step ended in an error (or null output), treat the job as failed.
      const allFailed =
        stepResults.length > 0 &&
        stepResults.every(
          s => s === null || (typeof s === 'object' && s !== null && 'error' in (s as object))
        );
      if (allFailed) {
        const errors = stepResults.map(s =>
          s === null ? 'null output' : (s as { error?: string }).error || 'unknown error'
        ).join('; ');
        const errMsg = `All steps failed: ${errors}`;
        console.error(`Job ${jobId} all steps failed:`, errors);
        db.prepare('UPDATE jobs SET status = ?, result = ?, error = ?, completed_at = ? WHERE id = ?')
          .run('failed', JSON.stringify(result), errMsg, new Date().toISOString(), jobId);
        return;
      }

      // Write summary note
      writeNote({
        kind: 'summary',
        content: `Completed job for routine "${routine.name}": ${plan.reasoning}`,
        userId,
        jobId,
        stability: 'volatile',
        ttlDays: 7,
      });
    } else if (job.tool_name) {
      // Direct tool_call execution (no LLM plan)
      const toolName = job.tool_name as string;
      const tool = getTool(toolName);
      if (!tool) {
        throw new Error(`Tool "${toolName}" not found`);
      }

      const toolInput = JSON.parse((job.tool_input as string) || '{}');
      const stepId = uuidv4();
      const stepStart = new Date().toISOString();

      db.prepare(`
        INSERT INTO step_runs (id, job_id, tool_name, input, started_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(stepId, jobId, toolName, JSON.stringify(toolInput), stepStart);

      const toolResult = await tool.run(toolInput, { userId, jobId });
      // Check tool-level error field for direct tool_call jobs
      if (toolResult.error) {
        const errMsg = `Tool "${toolName}" returned error: ${toolResult.error}`;
        db.prepare('UPDATE step_runs SET error = ?, completed_at = ? WHERE id = ?')
          .run(errMsg, new Date().toISOString(), stepId);
        throw new Error(errMsg);
      }
      db.prepare('UPDATE step_runs SET output = ?, artifact_path = ?, completed_at = ? WHERE id = ?')
        .run(
          JSON.stringify(toolResult.output),
          toolResult.artifactPath || null,
          new Date().toISOString(),
          stepId
        );

      result = { channel: 'direct', output: toolResult.output };
    } else {
      result = { message: 'Job completed (no routine or tool)' };
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
