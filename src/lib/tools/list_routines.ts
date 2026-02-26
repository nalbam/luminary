// src/lib/tools/list_routines.ts
import { getDb } from '../db';

export function listRoutinesForAgent(): Array<{ id: string; name: string; goal: string; triggerType: string }> {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, name, goal, trigger_type FROM routines WHERE enabled = 1 ORDER BY name ASC`
  ).all() as Array<{ id: string; name: string; goal: string; trigger_type: string }>;

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    goal: r.goal,
    triggerType: r.trigger_type,
  }));
}
