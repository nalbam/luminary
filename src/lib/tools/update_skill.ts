// src/lib/tools/update_skill.ts
import { getDb } from '../db';

export interface UpdateSkillInput {
  skillId: string;
  name?: string;
  goal?: string;
  tools?: string[];
}

export function updateSkillForAgent(input: UpdateSkillInput): { success: boolean; skillId: string } {
  const { skillId, name, goal, tools } = input;
  const db = getDb();
  const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId);
  if (!skill) throw new Error(`Skill ${skillId} not found`);

  db.prepare(`
    UPDATE skills SET
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
    skillId
  );

  return { success: true, skillId };
}
