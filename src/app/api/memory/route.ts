import { NextRequest, NextResponse } from 'next/server';
import { getNotes } from '@/lib/memory/notes';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'user_default';
    const kind = searchParams.get('kind') as 'log' | 'summary' | 'rule' | null;
    const limit = parseInt(searchParams.get('limit') || '50');

    const notes = getNotes({
      userId,
      kind: kind || undefined,
      limit,
    });

    return NextResponse.json({ notes });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
