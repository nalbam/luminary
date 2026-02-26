// src/lib/tools/delete_skill.ts
import { getDb } from '../db';

export function deleteSkillForAgent(skillId: string): { success: boolean; message: string } {
  const db = getDb();
  const skill = db.prepare('SELECT id, name FROM skills WHERE id = ?').get(skillId) as { id: string; name: string } | undefined;
  if (!skill) throw new Error(`Skill ${skillId} not found`);

  db.transaction(() => {
    // Cancel queued jobs to prevent orphaned execution after skill removal
    db.prepare(`UPDATE jobs SET status = 'canceled' WHERE skill_id = ? AND status = 'queued'`).run(skillId);
    db.prepare('DELETE FROM schedules WHERE skill_id = ?').run(skillId);
    db.prepare('DELETE FROM skills WHERE id = ?').run(skillId);
  })();

  return { success: true, message: `Skill "${skill.name}", its schedules, and queued jobs have been deleted.` };
}
