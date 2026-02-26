import { NextRequest, NextResponse } from 'next/server';
import { getDisplayHistory } from '@/lib/memory/conversations';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') || 'user_default';
  try {
    const messages = getDisplayHistory(userId);
    return NextResponse.json({ messages });
  } catch (e) {
    console.error('Conversations API error:', e);
    return NextResponse.json({ messages: [], error: String(e) }, { status: 500 });
  }
}
