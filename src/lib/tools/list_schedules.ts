// src/lib/tools/list_schedules.ts
import { getDb } from '../db';

export function listSchedulesForAgent(): Array<{
  id: string;
  skillId: string;
  skillName: string | null;
  cronExpr: string;
  enabled: boolean;
  lastRunAt: string | null;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.id, s.skill_id, sk.name as skill_name, s.cron_expr, s.enabled, s.last_run_at
    FROM schedules s
    LEFT JOIN skills sk ON sk.id = s.skill_id
    ORDER BY s.created_at DESC
  `).all() as Array<{
    id: string;
    skill_id: string;
    skill_name: string | null;
    cron_expr: string;
    enabled: number;
    last_run_at: string | null;
  }>;

  return rows.map(r => ({
    id: r.id,
    skillId: r.skill_id,
    skillName: r.skill_name,
    cronExpr: r.cron_expr,
    enabled: r.enabled === 1,
    lastRunAt: r.last_run_at,
  }));
}
