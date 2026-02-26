// src/lib/tools/list_schedules.ts
import { getDb } from '../db';

export function listSchedulesForAgent(): Array<{
  id: string;
  routineId: string | null;
  routineName: string | null;
  actionType: string;
  toolName: string | null;
  cronExpr: string;
  enabled: boolean;
  lastRunAt: string | null;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT s.id, s.routine_id, r.name as routine_name, s.action_type, s.tool_name, s.cron_expr, s.enabled, s.last_run_at
    FROM schedules s
    LEFT JOIN routines r ON r.id = s.routine_id
    ORDER BY s.created_at DESC
  `).all() as Array<{
    id: string;
    routine_id: string | null;
    routine_name: string | null;
    action_type: string;
    tool_name: string | null;
    cron_expr: string;
    enabled: number;
    last_run_at: string | null;
  }>;

  return rows.map(r => ({
    id: r.id,
    routineId: r.routine_id,
    routineName: r.routine_name,
    actionType: r.action_type,
    toolName: r.tool_name,
    cronExpr: r.cron_expr,
    enabled: r.enabled === 1,
    lastRunAt: r.last_run_at,
  }));
}
