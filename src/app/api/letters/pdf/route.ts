import { NextResponse, type NextRequest } from "next/server";

import { getUnit } from "@/lib/cortile";
import type { LetterPdfRequest } from "@/lib/letter-types";
import { letterFilename, renderLetterPdf } from "@/lib/letters";
import { explainBuilding } from "@/lib/matcher";

// POST /api/letters/pdf (LetterPdfRequest) -> application/pdf
// All figures, statuses and evidence are recomputed server-side; only the
// intro, explanation text and include flags are taken from the client.
export async function POST(request: NextRequest) {
  let body: Partial<LetterPdfRequest>;
  try {
    body = (await request.json()) as Partial<LetterPdfRequest>;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const buildingId = typeof body.buildingId === "string" ? body.buildingId : "";
  if (!buildingId)
    return NextResponse.json({ error: "missing_building" }, { status: 400 });

  const req: LetterPdfRequest = {
    buildingId,
    unitId: typeof body.unitId === "string" ? body.unitId : null,
    recipientName:
      typeof body.recipientName === "string" ? body.recipientName : null,
    intro: typeof body.intro === "string" ? body.intro : "",
    lines: (Array.isArray(body.lines) ? body.lines : [])
      .filter((l) => l && typeof l.category === "string")
      .map((l) => ({
        category: l.category,
        include: l.include !== false,
        explanation: typeof l.explanation === "string" ? l.explanation : "",
      })),
  };

  const unit = req.unitId ? getUnit(req.unitId) : null;
  if (req.unitId && (!unit || unit.buildingId !== buildingId))
    return NextResponse.json({ error: "unit_not_found" }, { status: 404 });

  try {
    const r = await explainBuilding(buildingId);
    if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const bytes = await renderLetterPdf({ r, req, unit });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${letterFilename(r, unit)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[letters/pdf] failed", e);
    return NextResponse.json({ error: "pdf_failed" }, { status: 500 });
  }
}
