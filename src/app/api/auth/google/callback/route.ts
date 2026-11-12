import { NextResponse, type NextRequest } from "next/server";

import { exchangeCode } from "@/lib/gmail/google";
import { STATE_COOKIE } from "@/lib/gmail/session";
import { consumeReturnTo, consumeStateCookie } from "@/lib/sealed-cookie";

// GET /api/auth/google/callback?code=…&state=… (Google redirects here)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const home = await consumeReturnTo(origin);

  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const validState = await consumeStateCookie(
    STATE_COOKIE,
    searchParams.get("state"),
  );

  if (error || !code || !validState) {
    home.searchParams.set("gmail", "error");
    home.searchParams.set("reason", error ?? "invalid_state");
    return NextResponse.redirect(home);
  }

  try {
    await exchangeCode(code, origin);
    home.searchParams.set("gmail", "connected");
  } catch (e) {
    console.error("[gmail] OAuth callback failed", e);
    home.searchParams.set("gmail", "error");
    home.searchParams.set("reason", "token_exchange_failed");
  }
  return NextResponse.redirect(home);
}
