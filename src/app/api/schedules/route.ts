import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { validateCronExpr } from '@/lib/tools/cron-utils';

export async function GET() {
  try {
    const db = getDb();
    const schedules = db.prepare('SELECT * FROM schedules ORDER BY created_at DESC').all();
    return NextResponse.json({ schedules });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { skillId, cronExpr } = body;

    if (!skillId || !cronExpr) {
      return NextResponse.json({ error: 'skillId and cronExpr are required' }, { status: 400 });
    }
    if (typeof skillId !== 'string' || typeof cronExpr !== 'string') {
      return NextResponse.json({ error: 'skillId and cronExpr must be strings' }, { status: 400 });
    }

    const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(skillId);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    try {
      validateCronExpr(cronExpr);
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO schedules (id, skill_id, cron_expr, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, skillId, cronExpr.trim(), now);

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id);
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
