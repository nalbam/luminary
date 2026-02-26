// src/lib/tools/cron-utils.ts
import cron from 'node-cron';

/**
 * Validates a cron expression using node-cron and enforces safety rules:
 * - Only 5-field expressions (no seconds field)
 * - Minimum 5-minute interval for "* /N" step patterns
 * - Wildcard (*) in the minute field is rejected (would run every minute)
 * Throws an Error with a descriptive message if invalid.
 */
export function validateCronExpr(cronExpr: string): void {
  const expr = cronExpr.trim();

  // Reject 6-field (seconds-level) expressions
  const fieldCount = expr.split(/\s+/).length;
  if (fieldCount !== 5) {
    throw new Error(
      `Invalid cron expression: "${cronExpr}". Must be a 5-field expression ` +
      '(minute hour day-of-month month day-of-week). ' +
      'Examples: "*/15 * * * *" (every 15 min), "0 9 * * *" (daily 9am UTC)'
    );
  }

  if (!cron.validate(expr)) {
    throw new Error(
      `Invalid cron expression: "${cronExpr}". ` +
      'Examples: "*/15 * * * *" (every 15 min), "0 * * * *" (hourly), ' +
      '"0 9 * * *" (daily 9am UTC), "0 9 * * 1" (Mon 9am UTC)'
    );
  }

  const minuteField = expr.split(/\s+/)[0];

  // Reject bare wildcard in minute field (runs every minute)
  if (minuteField === '*') {
    throw new Error(
      'Cron expression would run every minute. Minimum interval is 5 minutes. ' +
      'Use "*/5 * * * *" for every 5 minutes or "0 * * * *" for hourly.'
    );
  }

  // Enforce minimum 5-minute interval for */N patterns
  const everyNMinMatch = minuteField.match(/^\*\/(\d+)$/);
  if (everyNMinMatch && parseInt(everyNMinMatch[1], 10) < 5) {
    throw new Error('Minimum schedule interval is 5 minutes. Use "*/5 * * * *" or higher.');
  }
}
