import { NextResponse, type NextRequest } from "next/server";

import { parseBuildingQuery, type BuildingQuery } from "@/lib/ai";
import { buildingStats, type BuildingStats } from "@/lib/cortile";

const pct = (n: number | null) =>
  n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function reasonFor(b: BuildingStats, q: BuildingQuery) {
  const bits: string[] = [];
  if (q.sort_by === "insurance_increase")
    bits.push(`insurance ${pct(b.insuranceChangePct)}`);
  if (q.sort_by === "service_charge_increase")
    bits.push(`service charge ${pct(b.changePct)}`);
  if (q.sort_by === "open_tickets") bits.push(`${b.openTickets} open tickets`);
  if (q.min_homes != null || q.max_homes != null || q.sort_by === "largest")
    bits.push(`${b.homes} homes`);
  if (q.has_lift != null) bits.push(b.hasLift ? "has a lift" : "no lift");
  if (!bits.length) bits.push(`service charge ${pct(b.changePct)}`);
  return bits.filter(Boolean).join(" · ");
}

/** Keyword fallback when AI is unavailable. */
function keywordQuery(q: string): BuildingQuery {
  return {
    name: q,
    street: null,
    city: null,
    postcode: null,
    development: null,
    min_homes: null,
    max_homes: null,
    has_lift: null,
    sort_by: "relevance",
    interpretation: `Buildings matching “${q}”`,
  };
}

const has = (hay: string | null | undefined, needle: string | null) =>
  !needle || (hay ?? "").toLowerCase().includes(needle.toLowerCase());

// GET /api/buildings/search?q=<natural language>
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const all = buildingStats();

  // No query: suggest buildings whose service charge rose most
  if (!q) {
    const top = [...all]
      .filter((b) => b.changePct != null)
      .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))
      .slice(0, 6);
    return NextResponse.json({
      interpretation: "Biggest service-charge increases this year",
      usedAI: false,
      results: top.map((b) => ({
        ...b,
        reason: `service charge ${pct(b.changePct)}`,
      })),
    });
  }

  const parsed = await parseBuildingQuery(q);
  const query = parsed ?? keywordQuery(q);

  // Name words: every word must appear in the name/address/development
  const nameWords = (query.name ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  let results = all.filter(
    (b) =>
      nameWords.every((w) =>
        `${b.name} ${b.address} ${b.development ?? ""} ${b.postcode}`
          .toLowerCase()
          .includes(w),
      ) &&
      has(b.address, query.street) &&
      has(b.city, query.city) &&
      has(
        b.postcode.replace(/\s/g, ""),
        query.postcode?.replace(/\s/g, "") ?? null,
      ) &&
      has(b.development, query.development) &&
      (query.min_homes == null || (b.homes ?? 0) >= query.min_homes) &&
      (query.max_homes == null || (b.homes ?? 0) <= query.max_homes) &&
      (query.has_lift == null || b.hasLift === query.has_lift),
  );

  const key: Record<BuildingQuery["sort_by"], (b: BuildingStats) => number> = {
    relevance: (b) =>
      b.name.toLowerCase() === (query.name ?? "").toLowerCase() ? 1 : 0,
    service_charge_increase: (b) => b.changePct ?? -Infinity,
    insurance_increase: (b) => b.insuranceChangePct ?? -Infinity,
    open_tickets: (b) => b.openTickets,
    largest: (b) => b.homes ?? 0,
  };
  results = results.sort(
    (a, b) => key[query.sort_by](b) - key[query.sort_by](a),
  );

  return NextResponse.json({
    interpretation: query.interpretation,
    usedAI: !!parsed,
    filters: query,
    total: results.length,
    results: results
      .slice(0, 8)
      .map((b) => ({ ...b, reason: reasonFor(b, query) })),
  });
}
