// src/lib/tools/create_skill.ts — integration module (Telegram, Slack, etc.)
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export type SkillType = 'telegram' | 'slack' | 'google_calendar' | 'webhook' | 'custom';

export interface CreateSkillInput {
  name: string;
  type: SkillType;
  config?: Record<string, string>;
}

export function createSkillForAgent(
  input: CreateSkillInput
): { skillId: string; name: string; type: SkillType } {
  const { name, type, config = {} } = input;

  if (!name || !type) {
    throw new Error('name and type are required');
  }

  const validTypes: SkillType[] = ['telegram', 'slack', 'google_calendar', 'webhook', 'custom'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid type "${type}". Must be one of: ${validTypes.join(', ')}`);
  }

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO skills (id, name, type, config, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'unconfigured', ?, ?)
  `).run(id, name, type, JSON.stringify(config), now, now);

  return { skillId: id, name, type };
}
