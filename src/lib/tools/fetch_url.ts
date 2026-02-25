// src/lib/tools/fetch_url.ts
export async function fetchUrl(url: string, maxLength = 8000): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'vibemon-agent/1.0' },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (contentType.includes('application/json')) {
    return text.slice(0, maxLength);
  }

  // HTML → strip tags
  const stripped = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped.slice(0, maxLength);
}
