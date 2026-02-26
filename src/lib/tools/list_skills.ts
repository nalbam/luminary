// src/lib/tools/list_skills.ts — integration modules (Telegram, Slack, etc.)
import { getDb } from '../db';

export function listSkillsForAgent(): Array<{
  id: string;
  name: string;
  type: string;
  status: string;
  enabled: boolean;
  lastTestedAt: string | null;
}> {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, name, type, status, enabled, last_tested_at FROM skills ORDER BY name ASC`
  ).all() as Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    enabled: number;
    last_tested_at: string | null;
  }>;

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    type: r.type,
    status: r.status,
    enabled: r.enabled === 1,
    lastTestedAt: r.last_tested_at,
  }));
}
