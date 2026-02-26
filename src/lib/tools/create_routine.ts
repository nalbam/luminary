// src/lib/tools/create_routine.ts
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateRoutineInput {
  name: string;
  goal: string;
  triggerType?: 'manual' | 'schedule' | 'event';
  tools?: string[];
}

export function createRoutineForAgent(
  input: CreateRoutineInput
): { routineId: string; name: string } {
  const { name, goal, triggerType = 'manual', tools = [] } = input;

  if (!name || !goal) {
    throw new Error('name and goal are required');
  }

  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO routines (id, name, goal, trigger_type, tools, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, goal, triggerType, JSON.stringify(tools), now, now);

  return { routineId: id, name };
}
