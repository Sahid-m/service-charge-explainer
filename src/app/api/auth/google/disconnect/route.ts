import { NextResponse } from "next/server";

import { revokeToken } from "@/lib/gmail/google";
import { clearSession, readSession } from "@/lib/gmail/session";

// POST /api/auth/google/disconnect → revoke Google access and clear the cookie
export async function POST() {
  const session = await readSession();
  if (session) await revokeToken(session.refreshToken ?? session.accessToken);
  await clearSession();
  return NextResponse.json({ ok: true });
}
