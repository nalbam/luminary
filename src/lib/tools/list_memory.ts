import { registerTool } from './registry';
import { getNotes } from '../memory/notes';

registerTool({
  name: 'list_memory',
  description: 'Retrieves memory notes for the current user',
  inputSchema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['log', 'summary', 'rule'] },
      tags: { type: 'array', items: { type: 'string' } },
      limit: { type: 'number' },
    },
  },
  async run(input, context) {
    try {
      const notes = getNotes({
        userId: context.userId,
        kind: input.kind as 'log' | 'summary' | 'rule' | undefined,
        tags: input.tags as string[] | undefined,
        limit: (input.limit as number) || 20,
      });
      return { output: notes };
    } catch (e: unknown) {
      return { output: null, error: String(e) };
    }
  },
});
