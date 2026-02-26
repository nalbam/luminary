// src/lib/tools/cron-utils.ts
import cron from 'node-cron';

/**
 * Validates a cron expression using node-cron and enforces a minimum 5-minute interval.
 * Throws an Error with a descriptive message if invalid.
 */
export function validateCronExpr(cronExpr: string): void {
  const expr = cronExpr.trim();

  if (!cron.validate(expr)) {
    throw new Error(
      `Invalid cron expression: "${cronExpr}". ` +
      'Examples: "*/15 * * * *" (every 15 min), "0 * * * *" (hourly), ' +
      '"0 9 * * *" (daily 9am UTC), "0 9 * * 1" (Mon 9am UTC)'
    );
  }

  // Enforce minimum 5-minute interval to prevent abuse
  const everyNMinMatch = expr.match(/^\*\/(\d+)/);
  if (everyNMinMatch && parseInt(everyNMinMatch[1], 10) < 5) {
    throw new Error('Minimum schedule interval is 5 minutes');
  }
}
