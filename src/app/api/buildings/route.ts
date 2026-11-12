import { NextResponse } from "next/server";

import { listBuildingOptions } from "@/lib/cortile";

export async function GET() {
  return NextResponse.json(listBuildingOptions());
}
