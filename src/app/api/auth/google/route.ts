import { NextResponse, type NextRequest } from "next/server";

import { buildAuthUrl } from "@/lib/gmail/google";
import { STATE_COOKIE } from "@/lib/gmail/session";
import { setReturnTo, setStateCookie } from "@/lib/sealed-cookie";

// GET /api/auth/google → redirect to Google's consent screen
export async function GET(request: NextRequest) {
  const state = crypto.randomUUID();
  await setStateCookie(STATE_COOKIE, state);
  await setReturnTo(request.nextUrl.searchParams.get("returnTo"));
  return NextResponse.redirect(buildAuthUrl(state, request.nextUrl.origin));
}
