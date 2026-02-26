// src/lib/tools/create_schedule.ts
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { validateCronExpr } from './cron-utils';

export function createScheduleForAgent(
  skillId: string,
  cronExpr: string
): { scheduleId: string } {
  const db = getDb();
  const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId);
  if (!skill) throw new Error(`Skill ${skillId} not found`);

  validateCronExpr(cronExpr);

  const id = uuidv4();
  db.prepare(
    `INSERT INTO schedules (id, skill_id, cron_expr, created_at) VALUES (?, ?, ?, ?)`
  ).run(id, skillId, cronExpr.trim(), new Date().toISOString());

  return { scheduleId: id };
}
