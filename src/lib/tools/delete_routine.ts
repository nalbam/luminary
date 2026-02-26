// src/lib/tools/delete_routine.ts
import { getDb } from '../db';

export function deleteRoutineForAgent(routineId: string): { success: boolean; message: string } {
  const db = getDb();
  const routine = db.prepare('SELECT id, name FROM routines WHERE id = ?').get(routineId) as { id: string; name: string } | undefined;
  if (!routine) throw new Error(`Routine ${routineId} not found`);

  db.transaction(() => {
    // Cancel queued jobs to prevent orphaned execution after routine removal
    db.prepare(`UPDATE jobs SET status = 'canceled' WHERE routine_id = ? AND status = 'queued'`).run(routineId);
    db.prepare('DELETE FROM schedules WHERE routine_id = ?').run(routineId);
    db.prepare('DELETE FROM routines WHERE id = ?').run(routineId);
  })();

  return { success: true, message: `Routine "${routine.name}", its schedules, and queued jobs have been deleted.` };
}
