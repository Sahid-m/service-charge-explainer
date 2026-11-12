import { NextResponse, type NextRequest } from "next/server";

import { setReturnTo, setStateCookie } from "@/lib/sealed-cookie";
import { STATE_COOKIE, buildAuthUrl } from "@/lib/truelayer/client";

// GET /api/auth/truelayer → redirect to TrueLayer's bank-selection screen
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  let url: string;
  const state = crypto.randomUUID();
  try {
    url = buildAuthUrl(state, origin);
  } catch (e) {
    console.error("[truelayer]", e);
    return NextResponse.redirect(
      new URL("/app?bank=error&reason=not_configured", origin),
    );
  }
  await setStateCookie(STATE_COOKIE, state);
  await setReturnTo(request.nextUrl.searchParams.get("returnTo"));
  return NextResponse.redirect(url);
}
