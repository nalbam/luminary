// src/lib/loops/scheduler.ts
import { getDb } from '../db';
import { enqueueJob, runJob } from '../jobs/runner';
import cron from 'node-cron';

let schedulerStarted = false;
const registeredTasks = new Map<string, ReturnType<typeof cron.schedule>>();

interface ScheduleRow {
  id: string;
  skill_id: string;
  cron_expr: string;
}

function syncSchedules(): void {
  try {
    const db = getDb();
    const enabled = db.prepare(
      'SELECT id, skill_id, cron_expr FROM schedules WHERE enabled = 1'
    ).all() as ScheduleRow[];

    const enabledIds = new Set(enabled.map(s => s.id));

    // Remove tasks for disabled/deleted schedules
    for (const [id, task] of registeredTasks) {
      if (!enabledIds.has(id)) {
        task.stop();
        registeredTasks.delete(id);
      }
    }

    // Register new schedules
    for (const schedule of enabled) {
      if (registeredTasks.has(schedule.id)) continue;

      if (!cron.validate(schedule.cron_expr)) {
        console.warn(`Scheduler: invalid cron "${schedule.cron_expr}" for schedule ${schedule.id} — skipping`);
        continue;
      }

      const task = cron.schedule(schedule.cron_expr, async () => {
        console.log(`Triggering scheduled job for skill ${schedule.skill_id}`);
        try {
          const db2 = getDb();
          db2.prepare('UPDATE schedules SET last_run_at = ? WHERE id = ?')
            .run(new Date().toISOString(), schedule.id);
          const jobId = await enqueueJob(schedule.skill_id, 'schedule', {}, undefined);
          runJob(jobId).catch(e => console.error('Scheduled job error:', e));
        } catch (e) {
          console.error('Schedule trigger error:', e);
        }
      }, { timezone: 'UTC' });

      registeredTasks.set(schedule.id, task);
      console.log(`Registered schedule ${schedule.id} (${schedule.cron_expr})`);
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
