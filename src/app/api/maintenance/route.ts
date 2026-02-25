import { NextResponse } from 'next/server';
import { runMaintenance } from '@/lib/loops/maintenance';

export async function POST() {
  try {
    const result = await runMaintenance();
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
