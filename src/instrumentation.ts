// src/instrumentation.ts
// Next.js server instrumentation hook — runs once when the Node.js server starts.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run in the Node.js runtime, never during build or edge runtime.
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return;
  }

  // ── Scheduler Loop ──────────────────────────────────────────────────────────
  // Polls the `schedules` table every 60 s and fires skill jobs when due.
  const { startScheduler } = await import('./lib/loops/scheduler');
  startScheduler();

  // ── Maintenance Loop ────────────────────────────────────────────────────────
  // Prunes expired notes and merges old volatile notes.
  // Runs once at startup, then every 6 hours.
  const { runMaintenance } = await import('./lib/loops/maintenance');

  const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  // Initial run after a short delay so the DB is fully ready.
  setTimeout(async () => {
    try {
      const result = await runMaintenance();
      console.log('[maintenance]', result.message);
    } catch (e) {
      console.error('[maintenance] startup run failed:', e);
    }
  }, 5000);

  // Recurring run every 6 hours.
  setInterval(async () => {
    try {
      const result = await runMaintenance();
      console.log('[maintenance]', result.message);
    } catch (e) {
      console.error('[maintenance] scheduled run failed:', e);
    }
  }, MAINTENANCE_INTERVAL_MS);

  console.log('[instrumentation] scheduler and maintenance loops started');
}
