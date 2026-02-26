import { exec } from 'child_process';
import { promisify } from 'util';
import { registerTool } from './registry';

const execAsync = promisify(exec);

const TIMEOUT_MS = 30_000;
const MAX_OUTPUT = 8_000;

// Sensitive keys stripped from child process environment to prevent credential leakage
const SENSITIVE_ENV_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'BRAVE_SEARCH_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
];

function buildSafeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of SENSITIVE_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

export async function runBash(
  command: string,
  timeoutMs = TIMEOUT_MS
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      env: buildSafeEnv(),
      shell: '/bin/sh',
    });
    return {
      stdout: stdout.slice(0, MAX_OUTPUT),
      stderr: stderr.slice(0, MAX_OUTPUT),
      exitCode: 0,
    };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; code?: number; killed?: boolean };
    return {
      stdout: (err.stdout || '').slice(0, MAX_OUTPUT),
      stderr: err.killed
        ? `Command timed out after ${timeoutMs}ms`
        : (err.stderr || String(e)).slice(0, MAX_OUTPUT),
      exitCode: err.code ?? 1,
    };
  }
}

registerTool({
  name: 'run_bash',
  description: 'Execute a shell command and return stdout, stderr, and exit code. Use for file operations, running scripts, or any system-level task.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: `Timeout in milliseconds (default ${TIMEOUT_MS})` },
    },
    required: ['command'],
  },
  async run(input) {
    try {
      const result = await runBash(
        input.command as string,
        (input.timeout as number) || TIMEOUT_MS
      );
      return { output: result };
    } catch (e: unknown) {
      return { output: null, error: String(e) };
    }
  },
});
