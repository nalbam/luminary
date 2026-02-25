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

const registry = new Map<string, Tool>();

export function registerTool(tool: Tool): void {
  registry.set(tool.name, tool);
}

export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

export function listTools(): Tool[] {
  return Array.from(registry.values());
}
