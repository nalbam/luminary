// src/app/api/schedules/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { validateCronExpr } from '@/lib/tools/cron-utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const schedule = db.prepare(`
      SELECT s.*, r.name as routine_name
      FROM schedules s LEFT JOIN routines r ON r.id = s.routine_id
      WHERE s.id = ?
    `).get(id);
    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    return NextResponse.json({ schedule });
  } catch (e: unknown) {
    console.error('Schedules API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const body = await request.json();
    const { cronExpr, enabled, routineId, toolName, toolInput } = body;

    if (cronExpr !== undefined) {
      try {
        validateCronExpr(cronExpr);
      } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 400 });
      }
    }

    if (routineId !== undefined && routineId !== null) {
      const routine = db.prepare('SELECT id FROM routines WHERE id = ?').get(routineId);
      if (!routine) {
        return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (cronExpr !== undefined) { fields.push('cron_expr = ?'); values.push(cronExpr.trim()); }
    if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    if (routineId !== undefined) { fields.push('routine_id = ?'); values.push(routineId || null); }
    if (toolName !== undefined) { fields.push('tool_name = ?'); values.push(toolName || null); }
    if (toolInput !== undefined) { fields.push('tool_input = ?'); values.push(JSON.stringify(toolInput)); }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const schedule = db.prepare(`
      SELECT s.*, r.name as routine_name
      FROM schedules s LEFT JOIN routines r ON r.id = s.routine_id
      WHERE s.id = ?
    `).get(id);
    return NextResponse.json({ schedule });
  } catch (e: unknown) {
    console.error('Schedules API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.prepare('SELECT id FROM schedules WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
    return NextResponse.json({ message: 'Schedule deleted' });
  } catch (e: unknown) {
    console.error('Schedules API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
