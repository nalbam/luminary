import { registerTool } from './registry';

registerTool({
  name: 'web_search',
  description: 'Searches the web for information (stub)',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  async run(input) {
    // Stub implementation - can be enhanced with a real search API
    return {
      output: {
        query: input.query,
        results: [
          {
            title: 'Placeholder result',
            url: 'https://example.com',
            snippet: `This is a placeholder result for query: "${input.query}". Integrate a real search API to get actual results.`,
          },
        ],
        note: 'This is a stub implementation. Configure a real search provider for actual results.',
      },
    };
  },
});
