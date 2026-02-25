import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    return NextResponse.json({ skill });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
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

    const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE skills SET
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

    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    return NextResponse.json({ skill });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    return NextResponse.json({ message: 'Skill deleted' });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
