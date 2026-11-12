import { NextResponse } from "next/server";

import { listBuildings } from "@/lib/cortile";

export async function GET() {
  const buildings = listBuildings().map((b) => ({
    id: b.id,
    name: b.name,
    postcode: b.postcode,
  }));
  return NextResponse.json(buildings);
}
