import { NextResponse, type NextRequest } from "next/server";

import { removeConnection } from "@/lib/truelayer/client";

// POST /api/auth/truelayer/disconnect  { "id": "<credentialsId>" }
export async function POST(request: NextRequest) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  await removeConnection(id);
  return NextResponse.json({ ok: true });
}
