import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { runJob } from '@/lib/jobs/runner';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const steps = db.prepare('SELECT * FROM step_runs WHERE job_id = ? ORDER BY started_at ASC').all(id);
    return NextResponse.json({ job, steps });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'run') {
      runJob(id).catch(e => console.error('Job run error:', e));
      return NextResponse.json({ message: 'Job started' });
    }

    if (action === 'cancel') {
      const db = getDb();
      db.prepare('UPDATE jobs SET status = ? WHERE id = ? AND status IN ("queued")').run('canceled', id);
      return NextResponse.json({ message: 'Job canceled' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
