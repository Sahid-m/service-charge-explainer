import { readFileSync } from "node:fs";

import { NextResponse } from "next/server";

import { docPath } from "@/lib/local-docs";

// GET /api/docs/<buildingId>/<file>.pdf → the PDF, inline
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/docs/[building]/[file]">,
) {
  const { building, file } = await ctx.params;
  const full = docPath(building, decodeURIComponent(file));
  if (!full) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(readFileSync(full), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.replace(/"/g, "")}"`,
    },
  });
}
