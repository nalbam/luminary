// src/lib/tools/create_schedule.ts
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export function createScheduleForAgent(
  skillId: string,
  cronExpr: string
): { scheduleId: string } {
  const db = getDb();
  const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId);
  if (!skill) throw new Error(`Skill ${skillId} not found`);

  // Allowed patterns: */N (every N minutes), 0 * (hourly), 0 0 * (daily), 0 N * (specific hour)
  const ALLOWED_CRON = /^(\*\/\d+|\d+|\*) \* \* \* \*$|^0 \* \* \* \*$|^0 \d+ \* \* \*$/;
  if (!ALLOWED_CRON.test(cronExpr.trim())) {
    throw new Error(
      `Invalid cron expression: "${cronExpr}". ` +
      'Supported patterns: "*/N * * * *" (every N min), "0 * * * *" (hourly), "0 H * * *" (daily at hour H)'
    );
  }
  // Minimum 5-minute interval to prevent abuse
  const everyNMinMatch = cronExpr.match(/^\*\/(\d+)/);
  if (everyNMinMatch && parseInt(everyNMinMatch[1], 10) < 5) {
    throw new Error('Minimum schedule interval is 5 minutes');
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO schedules (id, skill_id, cron_expr, created_at) VALUES (?, ?, ?, ?)`
  ).run(id, skillId, cronExpr, new Date().toISOString());

  return { scheduleId: id };
}
