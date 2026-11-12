import "server-only";

import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Read-only data layer over the Cortile hackathon SQLite file.
 * (CORTILE_API_KEY is not needed for local reads and is never logged.)
 */

const DB_PATH = path.join(process.cwd(), "data", "cortile-hackathon.sqlite");

let db: DatabaseSync | null = null;
function conn() {
  if (!db) db = new DatabaseSync(DB_PATH, { readOnly: true });
  return db;
}

export type Building = {
  id: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  developmentName: string | null;
  freeholder: string | null;
};

export type BillLine = {
  id: string;
  buildingId: string;
  yearEnd: string; // financial_year_end, YYYY-MM-DD
  status: string;
  category: string;
  budgetGbp: number;
  actualGbp: number | null;
  /** The billed amount: actual if present, else budget */
  amountGbp: number;
};

export type Ticket = {
  id: string;
  buildingId: string;
  category: string;
  title: string;
  description: string;
  status: string;
  reportedAt: string;
  resolvedAt: string | null;
  contractorId: string | null;
  contractorName: string | null;
  costGbp: number | null;
};

type Row = Record<string, unknown>;

export function listBuildings(): Building[] {
  const rows = conn()
    .prepare(
      `select b.id, b.name, b.address_line_1, b.city, b.postcode,
              d.name as development_name, d.freeholder
         from buildings b left join developments d on d.id = b.development_id
        order by case when b.name like 'Building A%' then 0 else 1 end, b.name`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    address: String(r.address_line_1 ?? ""),
    city: String(r.city ?? ""),
    postcode: String(r.postcode ?? ""),
    developmentName: (r.development_name as string) ?? null,
    freeholder: (r.freeholder as string) ?? null,
  }));
}

export function getBuilding(id: string): Building | null {
  return listBuildings().find((b) => b.id === id) ?? null;
}

export function billLines(buildingId: string): BillLine[] {
  const rows = conn()
    .prepare(
      `select id, building_id, financial_year_end, status, category, budget_gbp, actual_gbp
         from service_charge_budgets where building_id = ?
        order by financial_year_end, category`,
    )
    .all(buildingId) as Row[];
  return rows.map((r) => {
    const actual = r.actual_gbp == null ? null : Number(r.actual_gbp);
    const budget = Number(r.budget_gbp ?? 0);
    return {
      id: String(r.id),
      buildingId: String(r.building_id),
      yearEnd: String(r.financial_year_end),
      status: String(r.status),
      category: String(r.category),
      budgetGbp: budget,
      actualGbp: actual,
      amountGbp: actual ?? budget,
    };
  });
}

/** Tickets reported in (from, to] — ISO date strings. */
export function tickets(
  buildingId: string,
  from: string,
  to: string,
): Ticket[] {
  const rows = conn()
    .prepare(
      `select t.id, t.building_id, t.category, t.title, t.description, t.status,
              t.reported_at, t.resolved_at, t.contractor_id, c.name as contractor_name, t.cost_gbp
         from tickets t left join contractors c on c.id = t.contractor_id
        where t.building_id = ? and t.reported_at > ? and t.reported_at <= ?
        order by t.reported_at`,
    )
    .all(buildingId, from, `${to}T23:59:59Z`) as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    buildingId: String(r.building_id),
    category: String(r.category),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    status: String(r.status ?? ""),
    reportedAt: String(r.reported_at),
    resolvedAt: (r.resolved_at as string) ?? null,
    contractorId: (r.contractor_id as string) ?? null,
    contractorName: (r.contractor_name as string) ?? null,
    costGbp: r.cost_gbp == null ? null : Number(r.cost_gbp),
  }));
}

/**
 * Bill categories (service_charge_budgets) → ticket categories that count as
 * evidence for them. There is no direct bill↔ticket key.
 */
export const BILL_TO_TICKET_CATEGORIES: Record<string, string[]> = {
  lift_maintenance: ["lift_breakdown", "lift_maintenance", "lift"],
  repairs_and_maintenance: [
    "repairs_and_maintenance",
    "plumbing",
    "leak",
    "drainage",
    "roof_and_gutters",
    "damp_and_mould",
    "pests",
  ],
  cleaning: ["cleaning"],
  communal_electricity: ["communal_lighting", "communal_electricity"],
  communal_heating: ["heating_and_hot_water", "communal_heating"],
  grounds_maintenance: ["grounds", "parking", "grounds_maintenance"],
  fire_safety: ["fire_safety_defect", "fire_safety"],
  door_entry_and_cctv: [
    "door_entry",
    "security_and_locks",
    "door_entry_and_cctv",
  ],
  water_hygiene: ["water_hygiene"],
  building_safety_costs: ["building_safety_costs"],
  health_and_safety: ["health_and_safety"],
};

export function ticketCategoriesFor(billCategory: string): string[] {
  return BILL_TO_TICKET_CATEGORIES[billCategory] ?? [billCategory];
}

/** Start (exclusive) of the financial year that ends on `yearEnd`. */
export function yearStart(yearEnd: string) {
  const d = new Date(`${yearEnd}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function cortileCounts() {
  const count = (table: string) =>
    Number(
      (conn().prepare(`select count(*) as n from ${table}`).get() as Row).n,
    );
  return {
    buildings: count("buildings"),
    tickets: count("tickets"),
    billLines: count("service_charge_budgets"),
  };
}

// ---- units (for service charge letters) ---------------------------------------

export type UnitRow = {
  unitId: string;
  buildingId: string;
  unitNumber: string;
  floor: number | null;
  type: string | null;
  sharePct: number;
  leaseholderName: string | null;
};

const UNIT_SQL = `select u.id, u.building_id, u.unit_number, u.floor, u.type,
    u.service_charge_share_pct,
    (select l.leaseholder_name from leases l where l.unit_id = u.id
       order by l.lease_start_date desc limit 1) as leaseholder_name
  from units u`;

function toUnit(r: Row): UnitRow {
  return {
    unitId: String(r.id),
    buildingId: String(r.building_id),
    unitNumber: String(r.unit_number),
    floor: r.floor == null ? null : Number(r.floor),
    type: r.type == null ? null : String(r.type),
    sharePct: Number(r.service_charge_share_pct ?? 0),
    leaseholderName:
      r.leaseholder_name == null ? null : String(r.leaseholder_name),
  };
}

export function listUnits(buildingId: string): UnitRow[] {
  const rows = conn()
    .prepare(`${UNIT_SQL} where u.building_id = ?`)
    .all(buildingId) as Row[];
  return rows
    .map(toUnit)
    .sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber, "en", { numeric: true }),
    );
}

export function getUnit(unitId: string): UnitRow | null {
  const r = conn().prepare(`${UNIT_SQL} where u.id = ?`).get(unitId) as
    Row | undefined;
  return r ? toUnit(r) : null;
}

/** Buildings with the details needed to tell same-named buildings apart. */
export function listBuildingOptions() {
  const rows = conn()
    .prepare(
      `select b.id, b.name, b.address_line_1, b.city, b.postcode, b.unit_count,
              d.name as development_name
         from buildings b left join developments d on d.id = b.development_id
        order by b.city, b.name, b.postcode`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    postcode: String(r.postcode ?? ""),
    address: String(r.address_line_1 ?? ""),
    city: String(r.city ?? ""),
    development: (r.development_name as string) ?? null,
    homes: Number(r.unit_count ?? 0),
  }));
}

export type BuildingStats = ReturnType<typeof listBuildingOptions>[number] & {
  hasLift: boolean;
  /** Latest financial year end with bill lines */
  yearEnd: string | null;
  totalCurr: number;
  totalPrev: number | null;
  changePct: number | null;
  insuranceChangePct: number | null;
  openTickets: number;
};

let statsCache: BuildingStats[] | null = null;

/** Per-building facts for smart search (computed once, in code). */
export function buildingStats(): BuildingStats[] {
  if (statsCache) return statsCache;
  const opts = new Map(listBuildingOptions().map((b) => [b.id, b]));
  const lifts = new Map(
    (conn().prepare(`select id, has_lift from buildings`).all() as Row[]).map(
      (r) => [String(r.id), Number(r.has_lift) === 1],
    ),
  );
  const open = new Map(
    (
      conn()
        .prepare(
          `select building_id, count(*) as n from tickets
            where status not in ('closed','resolved') group by building_id`,
        )
        .all() as Row[]
    ).map((r) => [String(r.building_id), Number(r.n)]),
  );
  const rows = conn()
    .prepare(
      `select building_id, financial_year_end as fye, category,
              coalesce(actual_gbp, budget_gbp) as amt
         from service_charge_budgets`,
    )
    .all() as Row[];
  // building -> year -> { total, insurance }
  const agg = new Map<string, Map<string, { total: number; ins: number }>>();
  for (const r of rows) {
    const b = String(r.building_id);
    const y = String(r.fye);
    const years = agg.get(b) ?? new Map();
    const cell = years.get(y) ?? { total: 0, ins: 0 };
    cell.total += Number(r.amt ?? 0);
    if (r.category === "buildings_insurance") cell.ins += Number(r.amt ?? 0);
    years.set(y, cell);
    agg.set(b, years);
  }
  const pct = (a: number, b: number | null | undefined) =>
    b ? ((a - b) / b) * 100 : null;
  statsCache = [...opts.values()].map((o) => {
    const years = agg.get(o.id);
    const keys = years ? [...years.keys()].sort() : [];
    const curr = keys.length ? years!.get(keys.at(-1)!)! : null;
    const prev = keys.length > 1 ? years!.get(keys.at(-2)!)! : null;
    return {
      ...o,
      hasLift: lifts.get(o.id) ?? false,
      yearEnd: keys.at(-1) ?? null,
      totalCurr: curr?.total ?? 0,
      totalPrev: prev?.total ?? null,
      changePct: curr ? pct(curr.total, prev?.total) : null,
      insuranceChangePct: curr ? pct(curr.ins, prev?.ins) : null,
      openTickets: open.get(o.id) ?? 0,
    };
  });
  return statsCache;
}
