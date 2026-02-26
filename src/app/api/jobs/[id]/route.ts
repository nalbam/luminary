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
    console.error('Jobs API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
      const db = getDb();
      const job = db.prepare('SELECT id, status FROM jobs WHERE id = ?').get(id) as { id: string; status: string } | undefined;
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      if (!['queued', 'failed'].includes(job.status)) {
        return NextResponse.json(
          { error: `Cannot run job in status "${job.status}". Only queued or failed jobs can be run.` },
          { status: 409 }
        );
      }
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
    console.error('Jobs API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
