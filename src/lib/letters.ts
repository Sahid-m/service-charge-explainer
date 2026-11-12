import "server-only";

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";

import { AI_MODEL, writeLetterText } from "./ai";
import type { UnitRow } from "./cortile";
import type {
  EvidenceChain,
  ExplainResult,
  ExplainedLine,
} from "./explain-types";
import type { LetterDraft, LetterLine, LetterPdfRequest } from "./letter-types";

// ---- formatting ------------------------------------------------------------------

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  const M = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function gbp(n: number): string {
  return `£${n.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function signedGbp(n: number): string {
  return `${n >= 0 ? "+" : "-"}${gbp(Math.abs(n))}`;
}

function pct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

/** "Swift Lift Engineering <accounts@x.com>" -> "Swift Lift Engineering" */
function senderName(from: string): string {
  const name = from
    .replace(/<[^>]*>/g, "")
    .replace(/"/g, "")
    .trim();
  return name || from;
}

// ---- evidence refs (built in code, never by the model) ---------------------------

function chainRef(c: EvidenceChain): string {
  const parts: string[] = [];
  if (c.ticket)
    parts.push(
      `Ticket ${c.ticket.id} "${c.ticket.title}" (${fmtDate(c.ticket.date)})`,
    );
  if (c.email) {
    const inv = c.email.invoiceNumbers[0];
    const head = inv ? `Invoice ${inv}` : `Email "${c.email.subject}"`;
    parts.push(
      `${head}, ${senderName(c.email.from)}, ${gbp(c.amountGbp)} (${fmtDate(c.email.date)})`,
    );
  } else if (c.ticket) {
    parts[parts.length - 1] += `, ${gbp(c.amountGbp)}`;
    if (c.ticket.contractor)
      parts[parts.length - 1] += `, ${c.ticket.contractor}`;
  }
  if (c.payment)
    parts.push(
      `Paid ${fmtDate(c.payment.date)} to ${c.payment.payee}${
        c.email || c.ticket ? "" : `, ${gbp(c.payment.amountGbp)}`
      }`,
    );
  return parts.join(" → ");
}

export function evidenceRefsFor(line: ExplainedLine): string[] {
  const refs = line.chains.map(chainRef).filter(Boolean);
  for (const d of line.docs)
    refs.push(`Document: ${d.name}${d.summary ? ` — ${d.summary}` : ""}`);
  if (line.uncostedTickets.length)
    refs.push(
      `${line.uncostedTickets.length} maintenance ticket${
        line.uncostedTickets.length === 1 ? "" : "s"
      } with no recorded cost`,
    );
  return refs;
}

// ---- template text (fallback when AI unavailable) --------------------------------

function changeClause(l: { prevGbp: number | null; changePct: number | null }) {
  if (l.prevGbp == null) return "";
  const p = pct(l.changePct);
  return `, compared with ${gbp(l.prevGbp)} last year${p ? ` (${p})` : ""}`;
}

export function templateExplanation(l: ExplainedLine): string {
  const base = `${l.label} comes to ${gbp(l.currGbp)} for the year${changeClause(l)}.`;
  if (l.status === "not_found")
    return `${base} Supporting evidence for this charge is still being obtained; we will write again once it is on file.`;
  const n = l.chains.length + l.docs.length;
  const firstInv = l.chains.find((c) => c.email?.invoiceNumbers[0])?.email
    ?.invoiceNumbers[0];
  const ev = `${n} item${n === 1 ? "" : "s"} of evidence on file account for ${Math.round(
    l.coveragePct,
  )}% of this charge${firstInv ? `, including invoice ${firstInv}` : ""}.`;
  return l.status === "partial"
    ? `${base} ${ev} Evidence for the remainder is still being obtained.`
    : `${base} ${ev}`;
}

function templateIntro(r: ExplainResult): string {
  const prev =
    r.totals.prevGbp != null
      ? `, compared with ${gbp(r.totals.prevGbp)} for the year ending ${fmtDate(r.years.prev)}`
      : "";
  return `This statement sets out the service charge for ${r.building.name} for the year ending ${fmtDate(
    r.years.curr,
  )}, totalling ${gbp(r.totals.currGbp)}${prev}. Each line has been traced to maintenance tickets, contractor invoices, bank payments and documents held on file; where evidence is still being obtained we say so.`;
}

// ---- draft -----------------------------------------------------------------------

export async function buildLetterDraft(r: ExplainResult): Promise<LetterDraft> {
  const refs = new Map(r.lines.map((l) => [l.category, evidenceRefsFor(l)]));

  const evidence = {
    building: r.building.name,
    yearEnding: r.years.curr,
    previousYearEnding: r.years.prev,
    totals: r.totals,
    lines: r.lines.map((l) => ({
      category: l.category,
      label: l.label,
      prevGbp: l.prevGbp,
      currGbp: l.currGbp,
      changeGbp: l.changeGbp,
      changePct: l.changePct == null ? null : Number(l.changePct.toFixed(1)),
      status: l.status,
      evidencedPct: Math.round(l.coveragePct),
      evidence: refs.get(l.category) ?? [],
    })),
  };

  let ai: Awaited<ReturnType<typeof writeLetterText>> = null;
  try {
    ai = await writeLetterText(evidence);
  } catch (e) {
    console.error("[letters] AI draft failed", e);
  }
  const aiByCat = new Map(
    (ai?.lines ?? []).map((x) => [x.category, x.explanation?.trim() ?? ""]),
  );

  const lines: LetterLine[] = r.lines.map((l) => ({
    category: l.category,
    label: l.label,
    prevGbp: l.prevGbp,
    currGbp: l.currGbp,
    changeGbp: l.changeGbp,
    changePct: l.changePct,
    status: l.status,
    coveragePct: l.coveragePct,
    explanation: aiByCat.get(l.category) || templateExplanation(l),
    evidenceRefs: refs.get(l.category) ?? [],
    include: true,
  }));

  return {
    buildingId: r.building.id,
    buildingName: r.building.name,
    buildingAddress: [r.building.address, r.building.postcode]
      .filter(Boolean)
      .join(", "),
    years: r.years,
    totals: r.totals,
    intro: ai?.intro?.trim() || templateIntro(r),
    lines,
    generatedBy: ai ? AI_MODEL : "template",
  };
}

// ---- PDF -------------------------------------------------------------------------

const hex = (h: string): RGB =>
  rgb(
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  );
const NAVY = hex("#0F172A");
const BLUE = hex("#0077CD");
const HEAD_FILL = hex("#EEF5FF");
const MUTED = hex("#64748B");
const RULE = hex("#CBD5E1");
const GREEN = hex("#15803D");
const AMBER = hex("#B45309");
const RED = hex("#B91C1C");

const STATUS_TEXT = {
  explained: "Explained",
  partial: "Partial",
  not_found: "Not found",
} as const;
const STATUS_COLOUR = { explained: GREEN, partial: AMBER, not_found: RED };

/** Make text safe for WinAnsi standard fonts. */
export function sanitize(s: string): string {
  return s
    .replace(/[✓✔]/g, "")
    .replace(/[✗✘]/g, "")
    .replace(/⚠️?/g, "")
    .replace(/[→⇒➜]/g, "->")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[  -​ ]/g, " ")
    .replace(/[\t\r]/g, " ")
    .replace(/[^\n\x20-\x7E¡-ÿ€•·]/g, "");
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 50;
const TOP = PAGE_H - 72;
const BOTTOM = 60;
const CONTENT_W = PAGE_W - 2 * M;

class Doc {
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = TOP;
  constructor(
    public pdf: PDFDocument,
    public font: PDFFont,
    public bold: PDFFont,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = TOP;
  }
  ensure(h: number) {
    if (this.y - h < BOTTOM) this.newPage();
  }
  wrap(text: string, size: number, width: number, f = this.font): string[] {
    const out: string[] = [];
    for (const para of sanitize(text).split("\n")) {
      const words = para.split(/ +/).filter(Boolean);
      let line = "";
      for (let w of words) {
        // hard-break words wider than the column
        while (f.widthOfTextAtSize(w, size) > width && w.length > 1) {
          let i = w.length - 1;
          while (i > 1 && f.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          if (line) {
            out.push(line);
            line = "";
          }
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        const next = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(next, size) <= width) line = next;
        else {
          if (line) out.push(line);
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  }
  text(
    s: string,
    x: number,
    y: number,
    opts: { size?: number; font?: PDFFont; color?: RGB } = {},
  ) {
    this.page.drawText(sanitize(s), {
      x,
      y,
      size: opts.size ?? 10,
      font: opts.font ?? this.font,
      color: opts.color ?? NAVY,
    });
  }
  para(
    s: string,
    opts: {
      size?: number;
      font?: PDFFont;
      color?: RGB;
      indent?: number;
      gap?: number;
      bullet?: boolean;
      keep?: boolean;
    } = {},
  ) {
    const size = opts.size ?? 10;
    const lh = size * 1.4;
    const indent = opts.indent ?? 0;
    const bx = opts.bullet ? 10 : 0;
    const lines = this.wrap(s, size, CONTENT_W - indent - bx, opts.font);
    if (opts.keep) this.ensure(lines.length * lh);
    lines.forEach((ln, i) => {
      this.ensure(lh);
      this.y -= lh;
      if (opts.bullet && i === 0)
        this.text("•", M + indent, this.y, { size, color: BLUE });
      this.text(ln, M + indent + bx, this.y, {
        size,
        font: opts.font,
        color: opts.color,
      });
    });
    this.y -= opts.gap ?? 6;
  }
  heading(s: string, size = 13) {
    this.ensure(size * 3);
    this.y -= size * 1.6;
    this.text(s, M, this.y, { size, font: this.bold, color: BLUE });
    this.y -= 4;
    this.page.drawLine({
      start: { x: M, y: this.y },
      end: { x: PAGE_W - M, y: this.y },
      thickness: 0.8,
      color: BLUE,
    });
    this.y -= 6;
  }
}

type Col = { title: string; w: number; align: "left" | "right" };

export type PdfInput = {
  r: ExplainResult;
  req: LetterPdfRequest;
  unit: UnitRow | null;
};

const cap = (s: unknown, n = 1500) =>
  typeof s === "string" ? s.trim().slice(0, n) : "";

export async function renderLetterPdf({ r, req, unit }: PdfInput) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Service charge statement - ${r.building.name}`);
  pdf.setAuthor("Block Management Team");
  pdf.setCreator("Service Lens");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const d = new Doc(pdf, font, bold);

  const clientByCat = new Map(
    (Array.isArray(req.lines) ? req.lines : []).map((l) => [l.category, l]),
  );
  const included = r.lines
    .filter((l) => clientByCat.get(l.category)?.include !== false)
    .map((l) => ({
      l,
      explanation:
        cap(clientByCat.get(l.category)?.explanation) || templateExplanation(l),
      refs: evidenceRefsFor(l),
    }));
  const share = unit ? unit.sharePct : null;
  const today = new Date().toISOString().slice(0, 10);
  const currLabel = fmtDate(r.years.curr);
  const prevLabel = r.years.prev ? fmtDate(r.years.prev) : "previous year";

  // (a) letterhead
  d.text("Block Management Team", M, d.y, {
    size: 16,
    font: bold,
    color: BLUE,
  });
  d.text(
    fmtDate(today),
    PAGE_W - M - font.widthOfTextAtSize(fmtDate(today), 10),
    d.y,
    {
      size: 10,
      color: MUTED,
    },
  );
  d.y -= 14;
  d.text("Service charge administration", M, d.y, { size: 9, color: MUTED });
  d.y -= 28;
  const recipient = unit
    ? [
        cap(req.recipientName, 200) ||
          unit.leaseholderName ||
          "The Leaseholder",
        `Flat ${unit.unitNumber}`,
        r.building.name,
        r.building.address,
        r.building.postcode,
      ]
    : [
        "All leaseholders",
        r.building.name,
        r.building.address,
        r.building.postcode,
      ];
  recipient.filter(Boolean).forEach((ln, i) => {
    d.text(ln, M, d.y, { size: 10, font: i === 0 ? bold : font });
    d.y -= 14;
  });
  d.y -= 16;

  // (b) title + (c) intro
  d.text(`Service charge statement - year ending ${currLabel}`, M, d.y, {
    size: 17,
    font: bold,
  });
  d.y -= 10;
  d.para(cap(req.intro) || templateIntro(r), { size: 10.5, gap: 4 });
  if (included.length < r.lines.length) {
    d.para(
      `This statement covers ${included.length} of the ${r.lines.length} lines of the bill. The totals in the schedule below reflect the included lines only.`,
      { size: 10, gap: 4 },
    );
  }

  // (d) schedule table
  d.heading("Schedule of charges");
  const cols: Col[] = unit
    ? [
        { title: "Line", w: 135, align: "left" },
        { title: `Year to ${prevLabel}`, w: 72, align: "right" },
        { title: `Year to ${currLabel}`, w: 72, align: "right" },
        { title: "Change", w: 78, align: "right" },
        { title: "Evidence", w: 62, align: "left" },
        { title: `Your share (${share!.toFixed(2)}%)`, w: 76, align: "right" },
      ]
    : [
        { title: "Line", w: 165, align: "left" },
        { title: `Year to ${prevLabel}`, w: 82, align: "right" },
        { title: `Year to ${currLabel}`, w: 82, align: "right" },
        { title: "Change", w: 92, align: "right" },
        { title: "Evidence", w: 74, align: "left" },
      ];
  const PAD = 4;
  const TS = 8.5;
  const drawRow = (
    cells: string[],
    o: { fill?: RGB; font?: PDFFont; colors?: (RGB | undefined)[] } = {},
  ) => {
    const wrapped = cells.map((c, i) =>
      d.wrap(c, TS, cols[i].w - 2 * PAD, i === 4 ? bold : (o.font ?? font)),
    );
    const n = Math.max(...wrapped.map((w) => w.length));
    const h = n * TS * 1.3 + 2 * PAD;
    if (d.y - h < BOTTOM) {
      d.newPage();
      drawHeader();
    }
    if (o.fill)
      d.page.drawRectangle({
        x: M,
        y: d.y - h,
        width: CONTENT_W,
        height: h,
        color: o.fill,
      });
    let x = M;
    wrapped.forEach((lines, i) => {
      const f = o.font ?? (i === 4 ? bold : font);
      lines.forEach((ln, j) => {
        const w = f.widthOfTextAtSize(ln, TS);
        const tx =
          cols[i].align === "right" ? x + cols[i].w - PAD - w : x + PAD;
        d.text(ln, tx, d.y - PAD - TS - j * TS * 1.3 + 1, {
          size: TS,
          font: f,
          color: o.colors?.[i] ?? NAVY,
        });
      });
      x += cols[i].w;
    });
    d.y -= h;
    d.page.drawLine({
      start: { x: M, y: d.y },
      end: { x: PAGE_W - M, y: d.y },
      thickness: 0.4,
      color: RULE,
    });
  };
  const drawHeader = () =>
    drawRow(
      cols.map((c) => c.title),
      { fill: HEAD_FILL, font: bold, colors: cols.map(() => BLUE) },
    );
  drawHeader();
  const change = (l: ExplainedLine) =>
    l.changeGbp == null
      ? "-"
      : `${signedGbp(l.changeGbp)}\n${pct(l.changePct)}`;
  for (const { l } of included) {
    const cells = [
      l.label,
      l.prevGbp == null ? "-" : gbp(l.prevGbp),
      gbp(l.currGbp),
      change(l),
      STATUS_TEXT[l.status],
    ];
    if (share != null) cells.push(gbp((l.currGbp * share) / 100));
    const colors: (RGB | undefined)[] = [];
    colors[4] = STATUS_COLOUR[l.status];
    drawRow(cells, { colors });
  }
  const totCurr = included.reduce((s, x) => s + x.l.currGbp, 0);
  const withPrev = included.filter((x) => x.l.prevGbp != null);
  const totPrev = withPrev.length
    ? withPrev.reduce((s, x) => s + (x.l.prevGbp ?? 0), 0)
    : null;
  const totChange = totPrev == null ? null : totCurr - totPrev;
  const totals = [
    "Total",
    totPrev == null ? "-" : gbp(totPrev),
    gbp(totCurr),
    totChange == null
      ? "-"
      : `${signedGbp(totChange)}\n${totPrev ? pct((totChange / totPrev) * 100) : ""}`,
    "",
  ];
  const shareTotal = share != null ? (totCurr * share) / 100 : null;
  if (shareTotal != null) totals.push(gbp(shareTotal));
  drawRow(totals, { fill: HEAD_FILL, font: bold });
  d.y -= 6;
  if (shareTotal != null)
    d.para(
      `Total due for Flat ${unit!.unitNumber}: ${gbp(shareTotal)} (${share!.toFixed(
        2,
      )}% of ${gbp(totCurr)}). Any payments on account already made will be credited against this amount.`,
      { size: 10, font: bold, gap: 4, keep: true },
    );
  if (included.length < r.lines.length)
    d.para(
      `${r.lines.length - included.length} line(s) of the bill are not covered by this statement.`,
      { size: 8.5, color: MUTED },
    );

  // (e) per-line explanations
  d.heading("Why each charge is what it is");
  for (const { l, explanation, refs } of included) {
    d.ensure(60);
    d.y -= 8;
    const fig = `${gbp(l.currGbp)}${
      l.prevGbp != null
        ? `  (last year ${gbp(l.prevGbp)}, ${pct(l.changePct)})`
        : ""
    }`;
    d.text(l.label, M, d.y - 11, { size: 11, font: bold });
    const st = STATUS_TEXT[l.status];
    d.text(st, PAGE_W - M - bold.widthOfTextAtSize(st, 9), d.y - 11, {
      size: 9,
      font: bold,
      color: STATUS_COLOUR[l.status],
    });
    d.y -= 15;
    d.para(fig, { size: 9, color: MUTED, gap: 2 });
    d.para(explanation, { size: 10, gap: 3 });
    if (l.status === "not_found" || refs.length === 0) {
      const who = l.category.includes("insurance")
        ? "the insurance broker"
        : (l.uncostedTickets.find((t) => t.contractor)?.contractor ??
          "the contractor");
      d.para(`No supporting evidence located yet - requested from ${who}.`, {
        size: 9,
        color: RED,
        indent: 6,
        bullet: true,
        gap: 2,
      });
    }
    for (const ref of refs)
      d.para(ref, { size: 8.5, indent: 6, bullet: true, gap: 1, color: NAVY });
    d.y -= 4;
  }

  // (f) appendix
  d.heading("Evidence appendix");
  d.para(
    "Every invoice, ticket, payment and document cited in this statement.",
    { size: 9, color: MUTED },
  );
  const seen = new Set<string>();
  const groups: Record<string, string[]> = {
    Invoices: [],
    "Maintenance tickets": [],
    "Bank payments": [],
    Documents: [],
  };
  const add = (g: string, key: string, s: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    groups[g].push(s);
  };
  for (const { l } of included) {
    for (const c of l.chains) {
      if (c.email)
        add(
          "Invoices",
          `e:${c.email.id}`,
          `${c.email.invoiceNumbers[0] ?? c.email.subject} - ${senderName(
            c.email.from,
          )} - ${gbp(c.amountGbp)} - ${fmtDate(c.email.date)} (${l.label})`,
        );
      if (c.ticket)
        add(
          "Maintenance tickets",
          `t:${c.ticket.id}`,
          `${c.ticket.id} "${c.ticket.title}" - ${fmtDate(c.ticket.date)}${
            c.ticket.contractor ? ` - ${c.ticket.contractor}` : ""
          }${c.ticket.costGbp != null ? ` - ${gbp(c.ticket.costGbp)}` : ""} (${l.label})`,
        );
      if (c.payment)
        add(
          "Bank payments",
          `p:${c.payment.date}:${c.payment.amountGbp}:${c.payment.payee}`,
          `${fmtDate(c.payment.date)} - ${c.payment.payee} - ${gbp(
            c.payment.amountGbp,
          )} (${l.label})`,
        );
    }
    for (const t of l.uncostedTickets)
      add(
        "Maintenance tickets",
        `t:${t.id}`,
        `${t.id} "${t.title}" - ${fmtDate(t.date)} - no recorded cost (${l.label})`,
      );
    for (const doc of l.docs)
      add("Documents", `d:${doc.id}`, `${doc.name} (${l.label})`);
  }
  let any = false;
  for (const [g, items] of Object.entries(groups)) {
    if (!items.length) continue;
    any = true;
    d.ensure(40);
    d.y -= 4;
    d.para(`${g} (${items.length})`, { size: 10, font: bold, gap: 1 });
    for (const it of items)
      d.para(it, { size: 8.5, bullet: true, indent: 6, gap: 1 });
  }
  if (!any)
    d.para("No evidence has been located yet for the included lines.", {
      size: 9,
    });

  // (g) closing
  d.heading("Questions about this statement");
  d.para(
    "If you would like to query any charge, please reply to this letter or email the Block Management Team quoting your flat number and the line concerned. You are entitled to request a summary of the costs and to inspect the supporting invoices and receipts.",
    { size: 10 },
  );
  d.para(
    "Lines marked Not found have no supporting evidence on file yet; we will write again when it is obtained.",
    { size: 10 },
  );
  d.ensure(70);
  d.y -= 22;
  d.text("Yours sincerely,", M, d.y, { size: 10 });
  d.y -= 26;
  d.text("Block Management Team", M, d.y, {
    size: 11,
    font: bold,
    color: BLUE,
  });

  // header + footer on every page
  const N = d.pages.length;
  const head = `Service Charge Statement - ${r.building.name}`;
  d.pages.forEach((p, i) => {
    p.drawText(sanitize(head), {
      x: M,
      y: PAGE_H - 36,
      size: 8.5,
      font: bold,
      color: BLUE,
    });
    p.drawLine({
      start: { x: M, y: PAGE_H - 44 },
      end: { x: PAGE_W - M, y: PAGE_H - 44 },
      thickness: 0.6,
      color: BLUE,
    });
    p.drawLine({
      start: { x: M, y: 42 },
      end: { x: PAGE_W - M, y: 42 },
      thickness: 0.4,
      color: RULE,
    });
    const foot = sanitize(
      `Page ${i + 1} of ${N} · Generated ${fmtDate(today)} · Figures traced to evidence by Service Lens`,
    );
    p.drawText(foot, {
      x: (PAGE_W - font.widthOfTextAtSize(foot, 7.5)) / 2,
      y: 30,
      size: 7.5,
      font,
      color: MUTED,
    });
  });

  return pdf.save();
}

export function letterFilename(r: ExplainResult, unit: UnitRow | null) {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  return `service-charge-${slug(r.building.name)}-${
    unit ? `flat-${slug(unit.unitNumber)}` : "building"
  }.pdf`;
}
