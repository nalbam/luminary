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
    console.error('Skills API error:', e);
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
    const { name, config, status, enabled } = body;

    const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    db.prepare(`
      UPDATE skills SET
        name = COALESCE(?, name),
        config = COALESCE(?, config),
        status = COALESCE(?, status),
        enabled = COALESCE(?, enabled),
        updated_at = ?
      WHERE id = ?
    `).run(
      name || null,
      config ? JSON.stringify(config) : null,
      status || null,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      new Date().toISOString(),
      id
    );

    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    return NextResponse.json({ skill });
  } catch (e: unknown) {
    console.error('Skills API error:', e);
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
    const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    return NextResponse.json({ message: 'Skill deleted' });
  } catch (e: unknown) {
    console.error('Skills API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
