import { NextResponse, type NextRequest } from "next/server";

import { buildLetterDraft } from "@/lib/letters";
import { explainBuilding } from "@/lib/matcher";

// POST /api/letters/draft { building } -> LetterDraft
export async function POST(request: NextRequest) {
  let body: { building?: unknown };
  try {
    body = (await request.json()) as { building?: unknown };
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const id = typeof body.building === "string" ? body.building : "";
  if (!id)
    return NextResponse.json({ error: "missing_building" }, { status: 400 });
  try {
    const r = await explainBuilding(id);
    if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(await buildLetterDraft(r));
  } catch (e) {
    console.error("[letters/draft] failed", e);
    return NextResponse.json({ error: "draft_failed" }, { status: 500 });
  }
}
