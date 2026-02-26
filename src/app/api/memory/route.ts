import { NextRequest, NextResponse } from 'next/server';
import { getNotes } from '@/lib/memory/notes';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'user_default';
    const kindRaw = searchParams.get('kind');
    const VALID_KINDS = ['log', 'summary', 'rule', 'soul', 'agent', 'user'] as const;
    const kind = VALID_KINDS.includes(kindRaw as typeof VALID_KINDS[number])
      ? (kindRaw as 'log' | 'summary' | 'rule' | 'soul' | 'agent' | 'user')
      : null;
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '50', 10) || 50));

    const notes = getNotes({
      userId,
      kind: kind || undefined,
      limit,
    });

    return NextResponse.json({ notes });
  } catch (e: unknown) {
    console.error('Memory API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
