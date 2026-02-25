import { NextRequest, NextResponse } from 'next/server';
import { ensureUserExists, getUser, updateUser } from '@/lib/memory/users';
import { applyAgentSoul, ensureSoulExists } from '@/lib/agent/soul';

// GET /api/users/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = ensureUserExists(id);
    // Ensure soul exists on every page load — recreates if accidentally deleted
    ensureSoulExists(id);
    return NextResponse.json({ user });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH /api/users/:id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = getUser(id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json();

    // Build the preferences patch (deep-merged inside updateUser)
    const prefPatch: Record<string, unknown> = {};
    if (body.interests !== undefined) prefPatch.interests = body.interests;
    if (body.agent !== undefined) prefPatch.agent = body.agent;
    if (body.onboarded !== undefined) prefPatch.onboarded = body.onboarded;

    const user = updateUser(id, {
      displayName: body.displayName,
      preferredName: body.preferredName,
      locale: body.locale,
      timezone: body.timezone,
      preferences: Object.keys(prefPatch).length > 0
        ? (prefPatch as import('@/lib/memory/users').UserPreferences)
        : undefined,
    });

    // If agent config provided, personalize the soul note
    if (body.agent && user) {
      applyAgentSoul(id, body.agent, user.preferredName);
    }

    return NextResponse.json({ user });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
