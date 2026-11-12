import { NextResponse, type NextRequest } from "next/server";

import { searchDriveDocs } from "@/lib/drive/evidence";
import { ensureFreshSession } from "@/lib/gmail/google";
import { readSession } from "@/lib/gmail/session";

// GET /api/evidence/drive?building=<name>
export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ connected: false });
  try {
    const fresh = await ensureFreshSession(session);
    const docs = await searchDriveDocs(
      fresh.accessToken,
      request.nextUrl.searchParams.get("building") ?? "",
    );
    return NextResponse.json({ docs });
  } catch (e) {
    console.error(
      "[evidence/drive] failed",
      e instanceof Error ? e.message : "",
    );
    return NextResponse.json(
      { error: "drive_request_failed" },
      { status: 502 },
    );
  }
}
