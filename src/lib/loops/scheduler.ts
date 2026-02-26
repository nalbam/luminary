// src/lib/loops/scheduler.ts
import { getDb } from '../db';
import { enqueueJob, runJob } from '../jobs/runner';
import cron from 'node-cron';

/** Mark a job as failed in DB when runJob() throws unexpectedly. Prevents zombie jobs. */
function handleJobError(jobId: string, e: unknown, context: string): void {
  try {
    const db = getDb();
    db.prepare('UPDATE jobs SET status = ?, error = ?, completed_at = ? WHERE id = ?')
      .run('failed', String(e), new Date().toISOString(), jobId);
  } catch (dbErr) {
    console.error(`Failed to update job ${jobId} status after error:`, dbErr);
  }
  console.error(`${context} [job=${jobId}]:`, e);
}

let schedulerStarted = false;

interface RegisteredTask {
  task: ReturnType<typeof cron.schedule>;
  cronExpr: string;
}
const registeredTasks = new Map<string, RegisteredTask>();

interface ScheduleRow {
  id: string;
  routine_id: string | null;
  action_type: 'routine' | 'tool_call';
  tool_name: string | null;
  tool_input: string | null;
  cron_expr: string;
}

function syncSchedules(): void {
  try {
    const db = getDb();
    const enabled = db.prepare(
      'SELECT id, routine_id, action_type, tool_name, tool_input, cron_expr FROM schedules WHERE enabled = 1'
    ).all() as ScheduleRow[];

    const enabledIds = new Set(enabled.map(s => s.id));

    // Remove tasks for disabled/deleted schedules
    for (const [id, { task }] of registeredTasks) {
      if (!enabledIds.has(id)) {
        task.stop();
        registeredTasks.delete(id);
      }
    }

    // Register new schedules (or re-register if cron_expr changed)
    for (const schedule of enabled) {
      const existing = registeredTasks.get(schedule.id);
      if (existing) {
        if (existing.cronExpr === schedule.cron_expr) continue; // No change
        // Expression changed — stop old task and re-register
        existing.task.stop();
        registeredTasks.delete(schedule.id);
      }

      if (!cron.validate(schedule.cron_expr)) {
        console.warn(`Scheduler: invalid cron "${schedule.cron_expr}" for schedule ${schedule.id} — skipping`);
        continue;
      }

      const task = cron.schedule(schedule.cron_expr, async () => {
        try {
          const db = getDb();
          db.prepare('UPDATE schedules SET last_run_at = ? WHERE id = ?')
            .run(new Date().toISOString(), schedule.id);

          if (schedule.action_type === 'tool_call' && schedule.tool_name) {
            // Direct tool_call: enqueue job with no routine
            console.log(`Triggering scheduled tool_call: ${schedule.tool_name}`);
            const jobDb = getDb();
            const jobId = await enqueueJob(null, 'schedule', {}, undefined);
            // Store tool info directly on the job row
            jobDb.prepare('UPDATE jobs SET tool_name = ?, tool_input = ? WHERE id = ?')
              .run(schedule.tool_name, schedule.tool_input || '{}', jobId);
            runJob(jobId).catch(e => handleJobError(jobId, e, 'Scheduled tool_call job error'));
          } else if (schedule.routine_id) {
            // Routine-based: enqueue job linked to routine
            console.log(`Triggering scheduled routine: ${schedule.routine_id}`);
            const jobId = await enqueueJob(schedule.routine_id, 'schedule', {}, undefined);
            runJob(jobId).catch(e => handleJobError(jobId, e, 'Scheduled routine job error'));
          } else {
            console.warn(`Schedule ${schedule.id} has no routine_id and action_type is not 'tool_call' — skipping`);
          }
        } catch (e) {
          console.error('Schedule trigger error:', e);
        }
      }, { timezone: 'UTC' });

      registeredTasks.set(schedule.id, { task, cronExpr: schedule.cron_expr });
      console.log(`Registered schedule ${schedule.id} (${schedule.cron_expr}, action_type=${schedule.action_type})`);
    }
  } catch (e) {
    console.error('Scheduler sync error:', e);
  }
}

export function startScheduler(): void {
  if (schedulerStarted) return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  schedulerStarted = true;

  // Register existing schedules immediately
  syncSchedules();

  // Poll every minute to pick up new schedules added at runtime
  setInterval(syncSchedules, 60 * 1000);

  console.log('Scheduler started');
}
