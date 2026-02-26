// src/lib/tools/cancel_job.ts
import { getDb } from '../db';

export function cancelJobForAgent(jobId: string): { success: boolean; message: string } {
  const db = getDb();
  const job = db.prepare('SELECT id, status FROM jobs WHERE id = ?').get(jobId) as { id: string; status: string } | undefined;
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status !== 'queued') {
    throw new Error(`Cannot cancel job in status "${job.status}". Only queued jobs can be canceled.`);
  }

  db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run('canceled', jobId);
  return { success: true, message: `Job ${jobId} has been canceled.` };
}
