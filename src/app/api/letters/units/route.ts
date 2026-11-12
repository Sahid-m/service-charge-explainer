import { NextResponse, type NextRequest } from "next/server";

import { getBuilding, listUnits } from "@/lib/cortile";
import type { UnitOption } from "@/lib/letter-types";

// GET /api/letters/units?building=<id>
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("building");
  if (!id)
    return NextResponse.json({ error: "missing_building" }, { status: 400 });
  if (!getBuilding(id))
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const units: UnitOption[] = listUnits(id).map((u) => ({
    unitId: u.unitId,
    unitNumber: u.unitNumber,
    sharePct: u.sharePct,
    leaseholderName: u.leaseholderName,
  }));
  return NextResponse.json(units);
}
