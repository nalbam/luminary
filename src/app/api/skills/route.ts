import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const skills = db.prepare('SELECT * FROM skills ORDER BY created_at DESC').all();
    return NextResponse.json({ skills });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
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
      INSERT INTO skills (id, name, goal, trigger_type, trigger_config, tools, budget, output_config, memory_config, created_at, updated_at)
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

    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    return NextResponse.json({ skill }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
