import { NextResponse, type NextRequest } from "next/server";

import { explainBuilding } from "@/lib/matcher";

// GET /api/explain?building=<id>
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("building");
  if (!id)
    return NextResponse.json({ error: "missing_building" }, { status: 400 });
  try {
    const result = await explainBuilding(id);
    if (!result)
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[explain] failed", e);
    return NextResponse.json({ error: "explain_failed" }, { status: 500 });
  }
}
