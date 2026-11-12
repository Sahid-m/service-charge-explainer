import { NextResponse, type NextRequest } from "next/server";

import { listRecentEmails } from "@/lib/gmail/api";
import { ensureFreshSession } from "@/lib/gmail/google";
import { readSession } from "@/lib/gmail/session";

// GET /api/gmail/messages?q=<gmail search>&max=10
export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    // 200 rather than 401 so "not connected" doesn't show as a console error
    return NextResponse.json({ connected: false });
  }

  try {
    const fresh = await ensureFreshSession(session);
    const { searchParams } = request.nextUrl;
    const emails = await listRecentEmails(fresh.accessToken, {
      q: searchParams.get("q") ?? "",
      max: Math.min(Number(searchParams.get("max")) || 10, 50),
    });
    return NextResponse.json({ email: fresh.email, emails });
  } catch (e) {
    console.error("[gmail] list failed", e);
    return NextResponse.json(
      { error: "gmail_request_failed" },
      { status: 502 },
    );
  }
}
