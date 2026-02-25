// src/lib/tools/fetch_url.ts
export async function fetchUrl(url: string, maxLength = 8000): Promise<string> {
  // Validate URL scheme
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`URL scheme not allowed: ${parsed.protocol}`);
  }

  // Block private/loopback ranges
  const hostname = parsed.hostname.toLowerCase();
  const BLOCKED = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^::1$/,
    /^fd[0-9a-f]{2}:/i,
  ];
  if (BLOCKED.some(re => re.test(hostname))) {
    throw new Error(`URL hostname not allowed (private/loopback): ${hostname}`);
  }

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
