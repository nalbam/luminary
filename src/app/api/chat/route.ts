import { NextRequest, NextResponse } from 'next/server';
import { handleUserMessage } from '@/lib/loops/interactive';
import { parseWebInput } from '@/lib/adapters/input/web';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = parseWebInput(body);
    
    const result = await handleUserMessage(
      input.message,
      input.userId,
      input.threadId
    );

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('Chat API error:', e);
    return NextResponse.json(
      { response: '', error: String(e) },
      { status: 500 }
    );
  }
}
