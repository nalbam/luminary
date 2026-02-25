import { getDb } from '../db';
import { enqueueJob, runJob } from '../jobs/runner';

let schedulerStarted = false;

interface ScheduleRow {
  id: string;
  skill_id: string;
  cron_expr: string;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
}

function parseCronInterval(cronExpr: string): number | null {
  // Simple cron parser for common patterns
  // Returns interval in milliseconds
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minute] = parts;

  // */N pattern for minutes
  const minuteMatch = minute.match(/^\*\/(\d+)$/);
  if (minuteMatch) {
    return parseInt(minuteMatch[1]) * 60 * 1000;
  }

  // Every hour: 0 * * * *
  if (cronExpr === '0 * * * *') return 60 * 60 * 1000;

  // Every day: 0 0 * * *
  if (cronExpr === '0 0 * * *') return 24 * 60 * 60 * 1000;

  return null;
}

export function startScheduler(): void {
  if (schedulerStarted) return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  schedulerStarted = true;

  // Check schedules every minute
  setInterval(async () => {
    try {
      const db = getDb();
      const schedules = db.prepare(
        'SELECT * FROM schedules WHERE enabled = 1'
      ).all() as ScheduleRow[];

      const now = new Date();

      for (const schedule of schedules) {
        const lastRun = schedule.last_run_at ? new Date(schedule.last_run_at) : null;
        const interval = parseCronInterval(schedule.cron_expr);

        if (!interval) continue;

        const shouldRun = !lastRun || (now.getTime() - lastRun.getTime()) >= interval;

        if (shouldRun) {
          console.log(`Triggering scheduled job for skill ${schedule.skill_id}`);

          db.prepare('UPDATE schedules SET last_run_at = ? WHERE id = ?')
            .run(now.toISOString(), schedule.id);

          const jobId = await enqueueJob(schedule.skill_id, 'schedule', {}, undefined);
          runJob(jobId).catch(e => console.error('Scheduled job error:', e));
        }
      }
    } catch (e) {
      console.error('Scheduler error:', e);
    }
  }, 60 * 1000);

  console.log('Scheduler started');
}
