import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { validateCronExpr } from '@/lib/tools/cron-utils';

export async function GET() {
  try {
    const db = getDb();
    const schedules = db.prepare(`
      SELECT s.*, r.name as routine_name
      FROM schedules s
      LEFT JOIN routines r ON r.id = s.routine_id
      ORDER BY s.created_at DESC
    `).all();
    return NextResponse.json({ schedules });
  } catch (e: unknown) {
    console.error('Schedules API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { routineId, cronExpr, toolName, toolInput } = body;

    if (!cronExpr) {
      return NextResponse.json({ error: 'cronExpr is required' }, { status: 400 });
    }
    if (!routineId && !toolName) {
      return NextResponse.json({ error: 'Either routineId or toolName is required' }, { status: 400 });
    }

    try {
      validateCronExpr(cronExpr);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }

    if (routineId) {
      const routine = db.prepare('SELECT id FROM routines WHERE id = ?').get(routineId);
      if (!routine) {
        return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
      }
    }

    const actionType = routineId ? 'routine' : 'tool_call';
    const id = uuidv4();
    const now = new Date().toISOString();

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
      now
    );

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (e: unknown) {
    console.error('Schedules API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
