import { NextResponse, type NextRequest } from "next/server";

import {
  TrueLayerError,
  ensureFresh,
  listAccounts,
  readConnections,
  type BankAccount,
  type Connection,
} from "@/lib/truelayer/client";

export type BankConnectionSummary = {
  id: string;
  provider: Connection["provider"];
  connectedAt: number;
  status: "ok" | "reconnect_required" | "error";
  accounts: BankAccount[];
};

const clientIp = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;

// GET /api/banking/accounts → every connected bank with its accounts, cards and balances
export async function GET(request: NextRequest) {
  const connections = await readConnections();
  const psuIp = clientIp(request);

  const results = await Promise.all(
    connections.map(async (conn): Promise<BankConnectionSummary> => {
      const base = {
        id: conn.credentialsId,
        provider: conn.provider,
        connectedAt: conn.connectedAt,
      };
      try {
        const fresh = await ensureFresh(conn);
        const accounts = await listAccounts(fresh, psuIp);
        return { ...base, status: "ok", accounts };
      } catch (e) {
        console.error(`[truelayer] accounts failed for ${conn.provider.id}`, e);
        const status =
          e instanceof TrueLayerError && e.status === 401
            ? "reconnect_required"
            : "error";
        return { ...base, status, accounts: [] };
      }
    }),
  );

  return NextResponse.json({ connections: results });
}
