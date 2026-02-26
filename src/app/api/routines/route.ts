import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const routines = db.prepare('SELECT * FROM routines ORDER BY created_at DESC').all();
    return NextResponse.json({ routines });
  } catch (e: unknown) {
    console.error('Routines API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { name, goal, triggerType, triggerConfig, tools, budget, outputConfig, memoryConfig } = body;

    if (!name || !goal || !triggerType) {
      return NextResponse.json({ error: 'name, goal, and triggerType are required' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO routines (id, name, goal, trigger_type, trigger_config, tools, budget, output_config, memory_config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, goal, triggerType,
      JSON.stringify(triggerConfig || {}),
      JSON.stringify(tools || []),
      JSON.stringify(budget || {}),
      JSON.stringify(outputConfig || {}),
      JSON.stringify(memoryConfig || {}),
      now, now
    );

    const routine = db.prepare('SELECT * FROM routines WHERE id = ?').get(id);
    return NextResponse.json({ routine }, { status: 201 });
  } catch (e: unknown) {
    console.error('Routines API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
