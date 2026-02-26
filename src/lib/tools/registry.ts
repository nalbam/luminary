export interface ToolContext {
  userId: string;
  jobId?: string;
}

export interface ToolResult {
  output: unknown;
  artifactPath?: string;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  run(input: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
}

// Use globalThis so the registry Map is shared across all Next.js module
// bundle instances (different API routes / instrumentation / scheduler).
// A plain module-level Map would be re-created per bundle in the App Router.
const g = globalThis as typeof globalThis & { _toolRegistry?: Map<string, Tool> };
if (!g._toolRegistry) {
  g._toolRegistry = new Map<string, Tool>();
}
const registry = g._toolRegistry;

export function registerTool(tool: Tool): void {
  registry.set(tool.name, tool);
}

export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

export function listTools(): Tool[] {
  return Array.from(registry.values());
}
