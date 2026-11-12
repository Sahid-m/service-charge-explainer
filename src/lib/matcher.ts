import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  billLines,
  getBuilding,
  ticketCategoriesFor,
  tickets as loadTickets,
  yearStart,
  type Ticket,
} from "@/lib/cortile";
import { searchDriveDocs, type DocEvidence } from "@/lib/drive/evidence";
import {
  buildGmailQuery,
  searchEmailEvidence,
  type EmailEvidence,
} from "@/lib/gmail/evidence";
import { ensureFreshSession } from "@/lib/gmail/google";
import { readSession } from "@/lib/gmail/session";
import { enrichEmail } from "@/lib/enrich";
import { invoiceEvidence, listLocalDocs, ticketRefs } from "@/lib/local-docs";
import type {
  DocEvidenceLite,
  EmailEvidenceLite,
  EvidenceChain,
  ExplainResult,
  ExplainedLine,
  PaymentEvidence,
  Status,
  TicketEvidence,
} from "@/lib/explain-types";
import {
  ensureFresh,
  listAccounts,
  listTransactions,
  readConnections,
} from "@/lib/truelayer/client";

/** All matching and maths happens here, in code. No LLM. */

const DAY = 86_400_000;
const AMOUNT_TOLERANCE = 1; // ± £1
const PAYMENT_WINDOW_DAYS = 60;
const EXPLAINED_THRESHOLD = 0.8;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  buildings_insurance: ["insurance", "broker", "premium", "policy"],
  management_fee: ["management fee", "management agreement"],
  accountancy_and_audit: ["accounts", "audit", "accountant"],
  lift_maintenance: ["lift"],
  repairs_and_maintenance: ["plumbing", "plumber", "leak", "repair"],
  cleaning: ["cleaning"],
  communal_electricity: ["electricity"],
  communal_heating: ["heating", "boiler"],
  fire_safety: ["fire"],
  water_hygiene: ["legionella", "water hygiene"],
};

const label = (c: string) =>
  c.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

const tokens = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (t) =>
        t.length >= 3 &&
        !["ltd", "limited", "services", "the", "and", "plc", "group"].includes(
          t,
        ),
    );

const namesOverlap = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false;
  const tb = new Set(tokens(b));
  return tokens(a).some((t) => tb.has(t));
};

const near = (a: number, b: number) => Math.abs(a - b) <= AMOUNT_TOLERANCE;
const ts = (d: string) => new Date(d).getTime();
const addDays = (d: string, n: number) =>
  new Date(ts(d) + n * DAY).toISOString().slice(0, 10);

function toTicket(t: Ticket): TicketEvidence {
  return {
    id: t.id,
    title: t.title,
    date: t.reportedAt,
    category: t.category,
    contractor: t.contractorName,
    costGbp: t.costGbp,
    status: t.status,
  };
}

function toEmail(e: EmailEvidence): EmailEvidenceLite {
  return {
    id: e.id,
    from: e.from,
    date: e.date,
    subject: e.subject,
    amountsGbp: e.amountsGbp,
    invoiceNumbers: e.invoiceNumbers,
    attachments: e.attachments.map((a) => a.filename),
    link: e.link,
    source: e.id.startsWith("pdf:") ? "pdf" : "gmail",
  };
}

// ---- bank ---------------------------------------------------------------

/** Planted/exported statement: data/bank-transactions.csv with header
 *  date,amount,payee,building,account  (amount negative = money out). */
function readCsvPayments(buildingId: string, buildingName: string) {
  const file = path.join(process.cwd(), "data", "bank-transactions.csv");
  if (!existsSync(file)) return null;
  const [header, ...rows] = readFileSync(file, "utf8").trim().split(/\r?\n/);
  const cols = header
    .toLowerCase()
    .split(",")
    .map((c) => c.trim());
  const idx = (n: string) => cols.indexOf(n);
  const out: PaymentEvidence[] = [];
  for (const row of rows) {
    const v = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const building = v[idx("building")] ?? "";
    if (
      idx("building") >= 0 &&
      building !== buildingId &&
      building.toLowerCase() !== buildingName.toLowerCase()
    )
      continue;
    const amount = Number(v[idx("amount")]);
    if (!Number.isFinite(amount)) continue;
    out.push({
      date: v[idx("date")],
      amountGbp: -amount, // positive = money out
      payee: v[idx("payee")] ?? "",
      source: "csv",
      account: idx("account") >= 0 ? v[idx("account")] : undefined,
    });
  }
  return out;
}

/** Transactions from the building's client account only (account name must contain the building name). */
async function readTrueLayerPayments(
  buildingName: string,
  from: string,
  to: string,
  warnings: string[],
) {
  const conns = await readConnections();
  if (conns.length === 0) return null;
  const out: PaymentEvidence[] = [];
  let matchedAccount = false;
  for (const c of conns) {
    try {
      const fresh = await ensureFresh(c);
      const accounts = await listAccounts(fresh);
      const clientAccounts = accounts.filter((a) =>
        a.name.toLowerCase().includes(buildingName.toLowerCase()),
      );
      for (const acc of clientAccounts) {
        matchedAccount = true;
        const txns = await listTransactions(fresh, {
          accountId: acc.id,
          kind: acc.kind,
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
        });
        for (const t of txns)
          out.push({
            date: t.timestamp,
            amountGbp: -t.amount,
            payee: t.merchant || t.description,
            source: "truelayer",
            account: acc.name,
          });
      }
    } catch (e) {
      console.error("[matcher] truelayer read failed", e);
    }
  }
  if (!matchedAccount) {
    warnings.push(
      `No connected bank account is named after "${buildingName}", so no client-account payments were read.`,
    );
    return null;
  }
  return out;
}

// ---- main -----------------------------------------------------------------

export async function explainBuilding(
  buildingId: string,
): Promise<ExplainResult | null> {
  const building = getBuilding(buildingId);
  if (!building) return null;
  const warnings: string[] = [];

  const lines = billLines(buildingId);
  const years = [...new Set(lines.map((l) => l.yearEnd))].sort();
  const curr = years.at(-1);
  if (!curr) return null;
  const prev = years.at(-2) ?? null;
  const currStart = yearStart(curr);

  // Sources -----------------------------------------------------------------
  let gmailToken: string | null = null;
  try {
    const s = await readSession();
    if (s) gmailToken = (await ensureFreshSession(s)).accessToken;
  } catch (e) {
    console.error("[matcher] gmail session", e);
    warnings.push("Gmail session expired — reconnect Gmail.");
  }

  let payments: PaymentEvidence[] | null = readCsvPayments(
    buildingId,
    building.name,
  );
  let bankSource: ExplainResult["sources"]["bank"] = payments ? "csv" : "none";
  if (!payments) {
    payments = await readTrueLayerPayments(
      building.name,
      currStart,
      addDays(curr, PAYMENT_WINDOW_DAYS),
      warnings,
    );
    if (payments) bankSource = "truelayer";
  }
  payments ??= [];

  let docs: DocEvidence[] = [];
  if (gmailToken) docs = await searchDriveDocs(gmailToken, building.name);

  // Real PDF documents for this building (data/docs/<id>/), parsed in code
  const localDocs = await listLocalDocs(buildingId);
  const pdfInvoices = localDocs
    .map((d) => ({
      doc: d,
      ev: invoiceEvidence(d),
      refs: ticketRefs(d.text, d.facts),
    }))
    .filter((x): x is typeof x & { ev: EmailEvidence } => !!x.ev);

  const allTickets = loadTickets(buildingId, currStart, curr);
  const usedPayments = new Set<PaymentEvidence>();
  const usedEmails = new Set<string>();

  const matchPayment = (
    amount: number,
    refDate: string,
    contractor?: string | null,
  ) => {
    const p = payments!.find(
      (p) =>
        !usedPayments.has(p) &&
        near(p.amountGbp, amount) &&
        Math.abs(ts(p.date) - ts(refDate)) <= PAYMENT_WINDOW_DAYS * DAY &&
        (!contractor || namesOverlap(p.payee, contractor)),
    );
    if (p) usedPayments.add(p);
    return p;
  };

  const currLines = lines.filter((l) => l.yearEnd === curr);
  const prevByCat = new Map(
    lines.filter((l) => l.yearEnd === prev).map((l) => [l.category, l]),
  );

  const explained: ExplainedLine[] = await Promise.all(
    currLines.map(async (line): Promise<ExplainedLine> => {
      const cats = ticketCategoriesFor(line.category);
      const lineTickets = allTickets.filter((t) => cats.includes(t.category));
      const costed = lineTickets.filter((t) => (t.costGbp ?? 0) > 0);
      const uncosted = lineTickets.filter((t) => !((t.costGbp ?? 0) > 0));

      // Emails: building terms + contractors (or category keywords) in the FY window
      let emails: EmailEvidence[] = [];
      if (gmailToken) {
        const contractors = [
          ...new Set(costed.map((t) => t.contractorName).filter(Boolean)),
        ] as string[];
        const kw = CATEGORY_KEYWORDS[line.category] ?? [label(line.category)];
        const q = buildGmailQuery({
          building: building.name,
          postcode: building.postcode,
          contractor: contractors.length
            ? contractors.slice(0, 4).join(" OR ")
            : undefined,
          after: currStart,
          before: addDays(curr, PAYMENT_WINDOW_DAYS),
        });
        const query = contractors.length
          ? q
          : `${q} (${kw.map((k) => `"${k}"`).join(" OR ")})`;
        try {
          const found = await searchEmailEvidence(gmailToken, query, 10);
          // AI reads each email (and its PDF attachments) for invoice facts
          emails = await Promise.all(
            found.map((e) => enrichEmail(gmailToken!, e)),
          );
        } catch (e) {
          console.error("[matcher] gmail search failed", e);
        }
      }

      // PDF invoices that belong to this line: they reference one of its
      // tickets, or (with no ticket ref) mention the line's keywords.
      const lineTicketIds = new Set(lineTickets.map((t) => t.id));
      const kwds = (
        CATEGORY_KEYWORDS[line.category] ?? [label(line.category)]
      ).map((k) => k.toLowerCase());
      const linePdfs = pdfInvoices.filter(({ doc, refs }) =>
        refs.size
          ? [...refs].some((r) => lineTicketIds.has(r))
          : kwds.some((k) => doc.text.toLowerCase().includes(k)),
      );
      const pdfRefs = new Map(linePdfs.map((p) => [p.ev.id, p.refs]));
      emails = [...linePdfs.map((p) => p.ev), ...emails];

      const chains: EvidenceChain[] = [];

      // 1) Costed tickets → invoice email → bank payment
      for (const t of costed) {
        const cost = t.costGbp!;
        const email =
          emails.find(
            (e) =>
              !usedEmails.has(e.id) &&
              pdfRefs.get(e.id)?.has(t.id) &&
              e.amountsGbp.some((a) => near(a, cost)),
          ) ??
          emails.find(
            (e) =>
              !usedEmails.has(e.id) &&
              e.amountsGbp.some((a) => near(a, cost)) &&
              (!t.contractorName ||
                namesOverlap(`${e.from} ${e.subject}`, t.contractorName) ||
                e.amountsGbp.length > 0),
          );
        if (email) usedEmails.add(email.id);
        const payment = matchPayment(
          cost,
          email?.date ?? t.resolvedAt ?? t.reportedAt,
          t.contractorName,
        );
        chains.push({
          amountGbp: cost,
          ticket: toTicket(t),
          email: email ? toEmail(email) : undefined,
          payment,
        });
      }

      // 2) Invoice emails with no ticket (e.g. insurance, management fee)
      for (const e of emails) {
        if (usedEmails.has(e.id)) continue;
        if (!e.invoiceNumbers.length || !e.amountsGbp.length) continue;
        const date = new Date(e.date);
        if (Number.isNaN(date.getTime())) continue;
        // pick the amount that a bank payment confirms, else the largest
        let amount = Math.max(...e.amountsGbp);
        let payment: PaymentEvidence | undefined;
        for (const a of e.amountsGbp) {
          payment = matchPayment(a, date.toISOString());
          if (payment) {
            amount = a;
            break;
          }
        }
        if (amount <= 0 || amount > line.amountGbp * 1.5) continue;
        usedEmails.add(e.id);
        chains.push({ amountGbp: amount, email: toEmail(e), payment });
      }

      const explainedGbp = chains.reduce((s, c) => s + c.amountGbp, 0);
      const coverage =
        line.amountGbp > 0 ? Math.min(explainedGbp / line.amountGbp, 1) : 0;
      const status: Status =
        coverage >= EXPLAINED_THRESHOLD
          ? "explained"
          : explainedGbp > 0
            ? "partial"
            : "not_found";

      const localLineDocs: DocEvidenceLite[] = localDocs
        .filter(
          (d) =>
            (d.kind === "insurance" &&
              line.category === "buildings_insurance") ||
            (d.kind === "management_agreement" &&
              line.category === "management_fee"),
        )
        .map((d) => ({
          id: `pdf:${d.file}`,
          name: d.file,
          kind: d.kind as DocEvidenceLite["kind"],
          link: d.link,
          summary: d.facts
            ? [
                d.facts.summary,
                d.facts.doc_type === "insurance_schedule"
                  ? d.facts.broker_commission_disclosed
                    ? "Broker commission disclosed."
                    : "No broker commission disclosed."
                  : null,
              ]
                .filter(Boolean)
                .join(" ")
            : undefined,
        }));
      const lineDocs: DocEvidenceLite[] = [
        ...localLineDocs,
        ...docs
          .filter(
            (d) =>
              (d.kind === "insurance" &&
                line.category === "buildings_insurance") ||
              (d.kind === "management_agreement" &&
                line.category === "management_fee"),
          )
          .map((d) => ({ id: d.id, name: d.name, kind: d.kind, link: d.link })),
      ];

      const prevLine = prevByCat.get(line.category);
      const prevGbp = prevLine?.amountGbp ?? null;
      return {
        category: line.category,
        label: label(line.category),
        prevGbp,
        currGbp: line.amountGbp,
        changeGbp: prevGbp == null ? null : line.amountGbp - prevGbp,
        changePct: prevGbp
          ? ((line.amountGbp - prevGbp) / prevGbp) * 100
          : null,
        explainedGbp,
        coveragePct: Math.round(coverage * 100),
        status,
        chains,
        uncostedTickets: uncosted.map(toTicket),
        docs: lineDocs,
      };
    }),
  );

  explained.sort(
    (a, b) => Math.abs(b.changeGbp ?? 0) - Math.abs(a.changeGbp ?? 0),
  );

  if (!gmailToken)
    warnings.push("Gmail not connected — no invoice emails searched.");

  const sum = (xs: (number | null)[]) =>
    xs.every((x) => x == null)
      ? null
      : xs.reduce<number>((s, x) => s + (x ?? 0), 0);

  return {
    building: {
      id: building.id,
      name: building.name,
      address: [building.address, building.city].filter(Boolean).join(", "),
      postcode: building.postcode,
    },
    years: { prev, curr },
    totals: {
      prevGbp: sum(explained.map((l) => l.prevGbp)),
      currGbp: explained.reduce((s, l) => s + l.currGbp, 0),
    },
    lines: explained,
    sources: {
      cortile: true,
      gmail: !!gmailToken,
      bank: bankSource,
      drive: docs.length > 0,
    },
    warnings,
  };
}
