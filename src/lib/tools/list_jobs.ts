// src/lib/tools/list_jobs.ts
import { getDb } from '../db';

export function listJobsForAgent(limit = 10): Array<{
  id: string;
  routineName: string | null;
  toolName: string | null;
  status: string;
  triggerType: string;
  createdAt: string;
  completedAt: string | null;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT j.id, r.name as routine_name, j.tool_name, j.status, j.trigger_type, j.created_at, j.completed_at
    FROM jobs j
    LEFT JOIN routines r ON r.id = j.routine_id
    ORDER BY j.created_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    id: string;
    routine_name: string | null;
    tool_name: string | null;
    status: string;
    trigger_type: string;
    created_at: string;
    completed_at: string | null;
  }>;

  return rows.map(r => ({
    id: r.id,
    routineName: r.routine_name,
    toolName: r.tool_name,
    status: r.status,
    triggerType: r.trigger_type,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }));
}
