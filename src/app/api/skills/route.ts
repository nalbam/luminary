import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const VALID_TYPES = ['telegram', 'slack', 'google_calendar', 'webhook', 'custom'] as const;
type SkillType = typeof VALID_TYPES[number];

export async function GET() {
  try {
    const db = getDb();
    const skills = db.prepare('SELECT * FROM skills ORDER BY name ASC').all();
    return NextResponse.json({ skills });
  } catch (e: unknown) {
    console.error('Skills API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { name, type, config } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(type as SkillType)) {
      return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO skills (id, name, type, config, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'unconfigured', ?, ?)
    `).run(id, name, type, JSON.stringify(config || {}), now, now);

    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    return NextResponse.json({ skill }, { status: 201 });
  } catch (e: unknown) {
    console.error('Skills API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
