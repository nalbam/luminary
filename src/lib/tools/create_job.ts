// src/lib/tools/create_job.ts
import { getDb } from '../db';
import { enqueueJob, runJob } from '../jobs/runner';

export async function createJobForAgent(
  routineId: string,
  input: Record<string, unknown>,
  userId: string
): Promise<{ jobId: string }> {
  const db = getDb();
  const routine = db.prepare('SELECT id, name FROM routines WHERE id = ?').get(routineId) as { id: string; name: string } | undefined;
  if (!routine) throw new Error(`Routine ${routineId} not found`);

  const jobId = await enqueueJob(routineId, 'manual', input, userId);
  runJob(jobId).catch(e => console.error('Agent-initiated job error:', e));
  return { jobId };
}
