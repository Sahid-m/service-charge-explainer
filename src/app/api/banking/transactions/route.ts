import { NextResponse, type NextRequest } from "next/server";

import {
  TrueLayerError,
  ensureFresh,
  listTransactions,
  readConnections,
} from "@/lib/truelayer/client";

const DAY = 24 * 60 * 60 * 1000;

// GET /api/banking/transactions?connection=<id>&account=<id>&kind=account|card&days=30
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const connectionId = sp.get("connection");
  const accountId = sp.get("account");
  const kind = sp.get("kind") === "card" ? "card" : "account";
  const days = Math.min(Math.max(Number(sp.get("days")) || 30, 1), 365);

  if (!connectionId || !accountId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const conn = (await readConnections()).find(
    (c) => c.credentialsId === connectionId,
  );
  if (!conn) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  try {
    const fresh = await ensureFresh(conn);
    const now = new Date();
    const transactions = await listTransactions(
      fresh,
      {
        accountId,
        kind,
        from: new Date(now.getTime() - days * DAY).toISOString(),
        to: now.toISOString(),
      },
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    );
    return NextResponse.json({ transactions });
  } catch (e) {
    console.error("[truelayer] transactions failed", e);
    if (e instanceof TrueLayerError && e.status === 401) {
      return NextResponse.json(
        { error: "reconnect_required" },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: "bank_request_failed" }, { status: 502 });
  }
}
