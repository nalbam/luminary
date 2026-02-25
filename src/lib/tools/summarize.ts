import { registerTool } from './registry';
import OpenAI from 'openai';

registerTool({
  name: 'summarize',
  description: 'Summarizes text using LLM',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to summarize' },
      maxLength: { type: 'number', description: 'Maximum summary length in words' },
    },
    required: ['text'],
  },
  async run(input) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { output: null, error: 'OPENAI_API_KEY not set' };
    }

    try {
      const openai = new OpenAI({ apiKey });
      const maxLength = (input.maxLength as number) || 100;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Summarize the following text in ${maxLength} words or less:\n\n${input.text}`,
          },
        ],
        max_tokens: maxLength * 2,
      });

      return { output: completion.choices[0]?.message?.content || '' };
    } catch (e: unknown) {
      return { output: null, error: String(e) };
    }
  },
});
