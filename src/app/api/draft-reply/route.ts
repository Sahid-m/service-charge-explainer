import { NextResponse } from "next/server";
import { llmReply, templateReply } from "@/lib/draft-reply";
import { explainBuilding } from "@/lib/matcher";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    building?: unknown;
  } | null;
  const building = typeof body?.building === "string" ? body.building : "";
  if (!building)
    return NextResponse.json({ error: "building required" }, { status: 400 });
  const r = await explainBuilding(building);
  if (!r)
    return NextResponse.json({ error: "building not found" }, { status: 404 });
  const llm = await llmReply(r);
  return NextResponse.json({
    draft: llm ?? templateReply(r),
    usedLLM: llm !== null,
  });
}
