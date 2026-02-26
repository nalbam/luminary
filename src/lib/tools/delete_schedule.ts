// src/lib/tools/delete_schedule.ts
import { getDb } from '../db';

export function deleteScheduleForAgent(scheduleId: string): { success: boolean; message: string } {
  const db = getDb();
  const schedule = db.prepare('SELECT id FROM schedules WHERE id = ?').get(scheduleId);
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);

  db.prepare('DELETE FROM schedules WHERE id = ?').run(scheduleId);
  return { success: true, message: `Schedule ${scheduleId} deleted.` };
}
