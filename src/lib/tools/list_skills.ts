// src/lib/tools/list_skills.ts
import { getDb } from '../db';

export function listSkillsForAgent(): Array<{ id: string; name: string; goal: string; triggerType: string }> {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, name, goal, trigger_type FROM skills WHERE enabled = 1 ORDER BY name ASC`
  ).all() as Array<{ id: string; name: string; goal: string; trigger_type: string }>;

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    goal: r.goal,
    triggerType: r.trigger_type,
  }));
}
