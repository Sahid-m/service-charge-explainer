import { existsSync } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { cortileCounts } from "@/lib/cortile";
import { readSession } from "@/lib/gmail/session";
import { readConnections } from "@/lib/truelayer/client";

// GET /api/status → which data sources are connected (no secrets, no tokens)
export async function GET() {
  const [gmail, banks] = await Promise.all([readSession(), readConnections()]);
  return NextResponse.json({
    cortile: { connected: true, ...cortileCounts() },
    gmail: { connected: !!gmail, email: gmail?.email },
    // Drive access is granted in the same Google consent as Gmail
    drive: { connected: !!gmail },
    bank: {
      connected: banks.length > 0,
      banks: banks.map((b) => b.provider.name),
      env: process.env.TRUELAYER_ENV === "live" ? "live" : "sandbox",
      csv: existsSync(
        path.join(process.cwd(), "data", "bank-transactions.csv"),
      ),
    },
  });
}
