// src/app/api/schedules/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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
