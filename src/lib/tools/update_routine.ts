// src/lib/tools/update_routine.ts
import { getDb } from '../db';

export interface UpdateRoutineInput {
  routineId: string;
  name?: string;
  goal?: string;
  tools?: string[];
}

export function updateRoutineForAgent(input: UpdateRoutineInput): { success: boolean; routineId: string } {
  const { routineId, name, goal, tools } = input;
  const db = getDb();
  const routine = db.prepare('SELECT id FROM routines WHERE id = ?').get(routineId);
  if (!routine) throw new Error(`Routine ${routineId} not found`);

  db.prepare(`
    UPDATE routines SET
      name = COALESCE(?, name),
      goal = COALESCE(?, goal),
      tools = COALESCE(?, tools),
      updated_at = ?
    WHERE id = ?
  `).run(
    name || null,
    goal || null,
    tools ? JSON.stringify(tools) : null,
    new Date().toISOString(),
    routineId
  );

  return { success: true, routineId };
}
