// src/lib/tools/search.ts
import { registerTool } from './registry';

// DuckDuckGo Instant Answer API (no key needed)
// Brave Search API (BRAVE_SEARCH_API_KEY takes priority when set)
export async function doSearch(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;

  if (braveKey) {
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
        { headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey } }
      );
      if (res.ok) {
        const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
        return (data.web?.results || []).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.description,
        }));
      } else {
        console.warn(`Brave Search API returned ${res.status} — falling back to DuckDuckGo`);
      }
    } catch {
      // Fall through to DuckDuckGo
    }
  }

  // Fallback: DuckDuckGo Instant Answer
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'User-Agent': 'luminary/1.0' } }
    );
    if (!res.ok) return [];

    const data = await res.json() as {
      AbstractText?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const results: Array<{ title: string; url: string; snippet: string }> = [];
    if (data.AbstractText) {
      results.push({ title: data.AbstractSource || 'DuckDuckGo', url: data.AbstractURL || '', snippet: data.AbstractText });
    }
    for (const topic of (data.RelatedTopics || []).slice(0, 4)) {
      if (topic.Text) {
        results.push({ title: topic.Text.slice(0, 60), url: topic.FirstURL || '', snippet: topic.Text });
      }
    }
    return results;
  } catch {
    return [];
  }
}

registerTool({
  name: 'web_search',
  description: 'Search the web for current information',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  async run(input) {
    try {
      const results = await doSearch(input.query as string);
      return { output: { query: input.query, results } };
    } catch (e: unknown) {
      return { output: null, error: String(e) };
    }
  },
});
