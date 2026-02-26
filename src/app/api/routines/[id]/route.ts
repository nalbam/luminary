import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const routine = db.prepare('SELECT * FROM routines WHERE id = ?').get(id);
    if (!routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }
    return NextResponse.json({ routine });
  } catch (e: unknown) {
    console.error('Routines API error:', e);
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
    const body = await request.json();
    const { name, goal, triggerType, triggerConfig, tools, budget, outputConfig, memoryConfig, enabled } = body;

    const existing = db.prepare('SELECT * FROM routines WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE routines SET
        name = COALESCE(?, name),
        goal = COALESCE(?, goal),
        trigger_type = COALESCE(?, trigger_type),
        trigger_config = COALESCE(?, trigger_config),
        tools = COALESCE(?, tools),
        budget = COALESCE(?, budget),
        output_config = COALESCE(?, output_config),
        memory_config = COALESCE(?, memory_config),
        enabled = COALESCE(?, enabled),
        updated_at = ?
      WHERE id = ?
    `).run(
      name || null,
      goal || null,
      triggerType || null,
      triggerConfig ? JSON.stringify(triggerConfig) : null,
      tools ? JSON.stringify(tools) : null,
      budget ? JSON.stringify(budget) : null,
      outputConfig ? JSON.stringify(outputConfig) : null,
      memoryConfig ? JSON.stringify(memoryConfig) : null,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      new Date().toISOString(),
      id
    );

    const routine = db.prepare('SELECT * FROM routines WHERE id = ?').get(id);
    return NextResponse.json({ routine });
  } catch (e: unknown) {
    console.error('Routines API error:', e);
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
    const existing = db.prepare('SELECT * FROM routines WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    db.transaction(() => {
      db.prepare(`UPDATE jobs SET status = 'canceled' WHERE routine_id = ? AND status = 'queued'`).run(id);
      db.prepare('DELETE FROM schedules WHERE routine_id = ?').run(id);
      db.prepare('DELETE FROM routines WHERE id = ?').run(id);
    })();

    return NextResponse.json({ message: 'Routine deleted' });
  } catch (e: unknown) {
    console.error('Routines API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
