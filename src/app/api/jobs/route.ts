import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { enqueueJob, runJob } from '@/lib/jobs/runner';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = 'SELECT * FROM jobs';
    const params: unknown[] = [];
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const jobs = db.prepare(query).all(...params);
    return NextResponse.json({ jobs });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skillId, triggerType, input, userId, runNow } = body;

    const jobId = await enqueueJob(
      skillId || null,
      triggerType || 'manual',
      input || {},
      userId || 'user_default'
    );

    if (runNow) {
      runJob(jobId).catch(e => console.error('Job run error:', e));
    }

    return NextResponse.json({ jobId });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
