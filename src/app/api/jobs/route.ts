import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enqueueJob, runJob } from '@/lib/jobs/runner';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));

    let query = `
      SELECT j.*, r.name as routine_name
      FROM jobs j
      LEFT JOIN routines r ON r.id = j.routine_id
    `;
    const VALID_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'canceled'];
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }
    const params: unknown[] = [];
    if (status) {
      query += ' WHERE j.status = ?';
      params.push(status);
    }
    query += ' ORDER BY j.created_at DESC LIMIT ?';
    params.push(limit);

    const jobs = db.prepare(query).all(...params);
    return NextResponse.json({ jobs });
  } catch (e: unknown) {
    console.error('Jobs API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { routineId, triggerType, input, userId, runNow } = body;

    const jobId = await enqueueJob(
      routineId || null,
      triggerType || 'manual',
      input || {},
      userId || 'user_default'
    );

    if (runNow) {
      runJob(jobId).catch(e => console.error('Job run error:', e));
    }

    return NextResponse.json({ jobId });
  } catch (e: unknown) {
    console.error('Jobs API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
