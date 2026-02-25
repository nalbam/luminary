// src/lib/tools/create_job.ts
import { getDb } from '../db';
import { enqueueJob, runJob } from '../jobs/runner';

export async function createJobForAgent(
  skillId: string,
  input: Record<string, unknown>,
  userId: string
): Promise<{ jobId: string }> {
  const db = getDb();
  const skill = db.prepare('SELECT id, name FROM skills WHERE id = ?').get(skillId) as { id: string; name: string } | undefined;
  if (!skill) throw new Error(`Skill ${skillId} not found`);

  const jobId = await enqueueJob(skillId, 'manual', input, userId);
  runJob(jobId).catch(e => console.error('Agent-initiated job error:', e));
  return { jobId };
}
