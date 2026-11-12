import { NextResponse, type NextRequest } from "next/server";

import { consumeReturnTo, consumeStateCookie } from "@/lib/sealed-cookie";
import { STATE_COOKIE, exchangeCode } from "@/lib/truelayer/client";

// TrueLayer redirects here with ?code=…&state=… (GET), or POSTs a form
// when response_mode=form_post. Handle both.
async function handle(request: NextRequest, params: URLSearchParams) {
  const origin = request.nextUrl.origin;
  const target = await consumeReturnTo(origin);
  // 303 so a POST callback becomes a GET of the return page
  const redirect = (status: "connected" | "error", reason?: string) => {
    const url = new URL(target);
    url.searchParams.set("bank", status);
    if (reason) url.searchParams.set("reason", reason);
    return NextResponse.redirect(url, 303);
  };

  const error = params.get("error");
  const code = params.get("code");
  const validState = await consumeStateCookie(
    STATE_COOKIE,
    params.get("state"),
  );

  if (error) return redirect("error", error);
  if (!code || !validState) return redirect("error", "invalid_state");

  try {
    await exchangeCode(code, origin);
    return redirect("connected");
  } catch (e) {
    console.error("[truelayer] OAuth callback failed", e);
    return redirect("error", "token_exchange_failed");
  }
}

export async function GET(request: NextRequest) {
  return handle(request, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params = new URLSearchParams();
  form.forEach((v, k) => params.set(k, String(v)));
  return handle(request, params);
}
