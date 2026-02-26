import { NextRequest, NextResponse } from 'next/server';
import { ensureUserExists, getUser, updateUser } from '@/lib/memory/users';
import { applyAgentNote, applyUserNote, ensureIdentityExists } from '@/lib/agent/soul';

// GET /api/users/:id
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = ensureUserExists(id);
    // Ensure all identity notes exist on every page load
    ensureIdentityExists(id);
    return NextResponse.json({ user });
  } catch (e: unknown) {
    console.error('Users API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    // Sync agent and user identity notes after settings save
    if (user) {
      if (body.agent) {
        applyAgentNote(id, body.agent, user.preferredName);
      }
      applyUserNote(id, user);
    }

    return NextResponse.json({ user });
  } catch (e: unknown) {
    console.error('Users API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
