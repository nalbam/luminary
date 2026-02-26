// src/lib/tools/create_schedule.ts
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { validateCronExpr } from './cron-utils';

export interface CreateScheduleInput {
  cronExpr: string;
  routineId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export function createScheduleForAgent(
  input: CreateScheduleInput
): { scheduleId: string; actionType: string } {
  const { cronExpr, routineId, toolName, toolInput } = input;

  if (!routineId && !toolName) {
    throw new Error('Either routineId or toolName must be provided');
  }
  if (routineId && toolName) {
    throw new Error('Provide either routineId or toolName, not both');
  }

  validateCronExpr(cronExpr);

  const db = getDb();

  if (routineId) {
    const routine = db.prepare('SELECT id FROM routines WHERE id = ?').get(routineId);
    if (!routine) throw new Error(`Routine ${routineId} not found`);
  }

  const id = uuidv4();
  const actionType = routineId ? 'routine' : 'tool_call';

  db.prepare(`
    INSERT INTO schedules (id, routine_id, action_type, tool_name, tool_input, cron_expr, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    routineId || null,
    actionType,
    toolName || null,
    toolInput ? JSON.stringify(toolInput) : '{}',
    cronExpr.trim(),
    new Date().toISOString()
  );

  return { scheduleId: id, actionType };
}
