import { NextResponse, type NextRequest } from "next/server";

import { ensureFreshSession } from "@/lib/gmail/google";
import { searchEmailEvidence } from "@/lib/gmail/evidence";
import { readSession } from "@/lib/gmail/session";

// GET /api/evidence/gmail?q=<gmail search>
export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ connected: false });
  try {
    const fresh = await ensureFreshSession(session);
    const emails = await searchEmailEvidence(
      fresh.accessToken,
      request.nextUrl.searchParams.get("q") ?? "",
    );
    return NextResponse.json({ emails });
  } catch (e) {
    console.error(
      "[evidence/gmail] failed",
      e instanceof Error ? e.message : "",
    );
    return NextResponse.json(
      { error: "gmail_request_failed" },
      { status: 502 },
    );
  }
}
