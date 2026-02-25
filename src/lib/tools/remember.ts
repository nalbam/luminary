import { registerTool } from './registry';
import { writeNote, NoteKind } from '../memory/notes';

registerTool({
  name: 'remember',
  description: 'Writes a memory note for the user',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Content to remember' },
      kind: { type: 'string', enum: ['log', 'summary', 'rule', 'soul'], description: 'Type of note' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the note' },
    },
    required: ['content'],
  },
  async run(input, context) {
    try {
      const note = writeNote({
        kind: (input.kind as NoteKind) || 'log',
        content: input.content as string,
        userId: context.userId,
        tags: (input.tags as string[]) || [],
        jobId: context.jobId,
      });
      return { output: { noteId: note.id, success: true } };
    } catch (e: unknown) {
      return { output: null, error: String(e) };
    }
  },
});
