// Generates a demo evidence pack (invoice PDFs, insurance schedule, bank CSV)
// for Fir House (bld_0853) from the Cortile SQLite data. Not real documents.
// Run: node scripts/make-demo-pack.mjs
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILDING_ID = "bld_0853";
const OUT = join(ROOT, "data/docs", BUILDING_ID);
const REPAIR_CATS = ["leak", "drainage", "roof_and_gutters", "damp_and_mould", "pests"];
const LIFT_CATS = ["lift_breakdown"];
const INSURER = "Albion Mutual Insurance plc";

const db = new DatabaseSync(join(ROOT, "data/cortile-hackathon.sqlite"), { readOnly: true });

const building = db
  .prepare(
    `SELECT b.id, b.name, b.address_line_1, b.city, b.postcode, b.storeys, b.unit_count, b.built_year,
            d.name AS development, d.freeholder
       FROM buildings b LEFT JOIN developments d ON d.id = b.development_id WHERE b.id = ?`,
  )
  .get(BUILDING_ID);

// Latest financial year in the bill table; window = the 12 months ending then.
const { fye } = db
  .prepare(`SELECT MAX(financial_year_end) AS fye FROM service_charge_budgets WHERE building_id = ?`)
  .get(BUILDING_ID);
const fyEnd = new Date(fye + "T00:00:00Z");
const fyStart = new Date(fyEnd);
fyStart.setUTCFullYear(fyStart.getUTCFullYear() - 1);
const windowStart = iso(fyStart); // exclusive
const periodStart = iso(addDays(fyStart, 1));

const cats = [...REPAIR_CATS, ...LIFT_CATS];
const tickets = db
  .prepare(
    `SELECT t.id, t.category, t.title, t.description, t.reported_at, t.resolved_at, t.cost_gbp,
            c.name AS contractor, c.trade, c.city AS contractor_city
       FROM tickets t LEFT JOIN contractors c ON c.id = t.contractor_id
      WHERE t.building_id = ? AND t.reported_at > ? AND t.reported_at <= ?
        AND t.category IN (${cats.map(() => "?").join(",")})
        AND t.cost_gbp > 0
      ORDER BY t.reported_at`,
  )
  .all(BUILDING_ID, windowStart, fye + "T23:59:59Z", ...cats);

const insurance = db
  .prepare(
    `SELECT actual_gbp FROM service_charge_budgets
      WHERE building_id = ? AND financial_year_end = ? AND category = 'buildings_insurance'`,
  )
  .get(BUILDING_ID, fye);

// ---------- helpers ----------
function iso(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function ukDate(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
function gbp(n) {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function hash(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
function invoiceNo(ticketId) {
  const digits = ticketId.replace(/\D/g, "");
  return "INV-" + String((hash(ticketId) % 9000) + 1000) + digits.slice(-2);
}
function vatNo(name) {
  const n = String(hash(name + "vat")).padStart(9, "0").slice(0, 9);
  return `GB ${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7)}`;
}
const STREETS = ["Unit 4, Mill Lane Trading Estate", "17 Station Road", "Unit 12, Eastside Business Park", "88 Commercial Road", "3 Kingsway Industrial Estate"];
const POSTCODES = { Southampton: ["SO15 1GH", "SO14 5QA", "SO16 0AS", "SO18 2NU"] };
function contractorAddress(name, city) {
  const h = hash(name);
  const pcs = POSTCODES[city] ?? ["AB1 2CD"];
  return [STREETS[h % STREETS.length], city, pcs[h % pcs.length]];
}
function wrap(text, font, size, maxWidth) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

const A4 = [595.28, 841.89];
const M = 50;
const GREY = rgb(0.4, 0.4, 0.4);
const LINE = rgb(0.8, 0.8, 0.8);
const ACCENT = rgb(0.12, 0.25, 0.45);

async function newDoc(title) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer("Cortile hackathon demo pack");
  const page = doc.addPage(A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = (s, x, y, o = {}) =>
    page.drawText(String(s), { x, y, size: o.size ?? 10, font: o.bold ? bold : font, color: o.color ?? rgb(0, 0, 0) });
  const right = (s, xr, y, o = {}) => {
    const f = o.bold ? bold : font;
    text(s, xr - f.widthOfTextAtSize(String(s), o.size ?? 10), y, o);
  };
  const hr = (y) => page.drawLine({ start: { x: M, y }, end: { x: A4[0] - M, y }, thickness: 0.7, color: LINE });
  return { doc, page, font, bold, text, right, hr };
}

const siteLine = `${building.name}, ${building.address_line_1}, ${building.city}, ${building.postcode}`;
const billTo = building.freeholder && building.freeholder.trim() ? building.freeholder : "Fir House RMC Ltd";

// ---------- invoices ----------
mkdirSync(OUT, { recursive: true });
const rows = [];
for (const t of tickets) {
  const inv = invoiceNo(t.id);
  const invDate = addDays(new Date(t.resolved_at ?? t.reported_at), 3);
  const dueDate = addDays(invDate, 30);
  const payDate = addDays(invDate, 14);
  const total = Math.round(t.cost_gbp * 100) / 100;
  const net = Math.round((total / 1.2) * 100) / 100;
  const vat = Math.round((total - net) * 100) / 100;

  const { doc, page, font, text, right, hr } = await newDoc(`Invoice ${inv} - ${t.contractor}`);
  const W = A4[0];
  let y = A4[1] - M;
  text(t.contractor, M, y, { size: 16, bold: true, color: ACCENT });
  right("INVOICE", W - M, y, { size: 22, bold: true, color: ACCENT });
  y -= 16;
  const [st, city, pc] = contractorAddress(t.contractor, t.contractor_city);
  for (const l of [st, `${city} ${pc}`, `${t.trade ?? "Property services"}`, `VAT Reg No: ${vatNo(t.contractor)}`]) {
    text(l, M, y, { size: 9, color: GREY });
    y -= 12;
  }
  let ry = A4[1] - M - 30;
  for (const [k, v] of [
    ["Invoice No:", inv],
    ["Invoice date:", ukDate(invDate)],
    ["Due date:", ukDate(dueDate)],
    ["Your ref:", t.id],
  ]) {
    right(k, W - M - 110, ry, { size: 9, bold: true });
    right(v, W - M, ry, { size: 9 });
    ry -= 13;
  }
  y = Math.min(y, ry) - 20;
  hr(y);
  y -= 20;
  text("Bill to:", M, y, { bold: true });
  text("Site:", W / 2, y, { bold: true });
  y -= 14;
  const billLines = [billTo, "c/o Block Management Team", building.address_line_1, `${building.city} ${building.postcode}`];
  const siteLines = [building.name, building.address_line_1, `${building.city}, ${building.postcode}`];
  for (let i = 0; i < billLines.length; i++) {
    text(billLines[i], M, y - i * 12, { size: 9 });
    if (siteLines[i]) text(siteLines[i], W / 2, y - i * 12, { size: 9 });
  }
  y -= billLines.length * 12 + 20;
  // table header
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.93, 0.95, 0.98) });
  text("Description", M + 6, y, { bold: true, size: 9 });
  right("Qty", 380, y, { bold: true, size: 9 });
  right("Net", 460, y, { bold: true, size: 9 });
  right("Amount", W - M - 6, y, { bold: true, size: 9 });
  y -= 22;
  text(t.title, M + 6, y, { bold: true, size: 10 });
  right("1", 380, y, { size: 9 });
  right(gbp(net), 460, y, { size: 9 });
  right(gbp(net), W - M - 6, y, { size: 9 });
  y -= 13;
  const desc = `Attendance and remedial works at ${building.name}. ${t.description ?? ""}`.trim();
  for (const l of wrap(desc, font, 8.5, 290).slice(0, 5)) {
    text(l, M + 6, y, { size: 8.5, color: GREY });
    y -= 11;
  }
  y -= 10;
  hr(y);
  y -= 20;
  for (const [k, v, b] of [
    ["Subtotal (net)", gbp(net)],
    ["VAT @ 20%", gbp(vat)],
    ["TOTAL", gbp(total), true],
  ]) {
    right(k, 440, y, { size: 10, bold: b });
    right(v, W - M - 6, y, { size: 10, bold: b });
    y -= 16;
  }
  y -= 6;
  page.drawRectangle({ x: 300, y: y - 8, width: W - M - 300, height: 24, color: ACCENT });
  right(`Total due: ${gbp(total)}`, W - M - 10, y, { size: 12, bold: true, color: rgb(1, 1, 1) });
  // footer
  let fy = 120;
  page.drawLine({ start: { x: M, y: fy + 15 }, end: { x: W - M, y: fy + 15 }, thickness: 0.7, color: LINE });
  text("Payment details", M, fy, { bold: true, size: 9 });
  fy -= 13;
  const sort = String(hash(t.contractor + "sc")).slice(0, 6).replace(/(\d\d)(\d\d)(\d\d)/, "$1-$2-$3");
  const acct = String(hash(t.contractor + "ac")).padStart(8, "0").slice(0, 8);
  for (const l of [
    `Payment terms: 30 days from invoice date. Please quote ${inv} as the payment reference.`,
    `Bank transfer to: ${t.contractor}   Sort code: ${sort}   Account no: ${acct}`,
    `Queries: accounts@${t.contractor.toLowerCase().replace(/[^a-z]+/g, "")}.co.uk`,
    "Demo document generated for the Cortile hackathon. Not a real invoice.",
  ]) {
    text(l, M, fy, { size: 8, color: GREY });
    fy -= 11;
  }
  const file = `invoice-${inv}.pdf`;
  writeFileSync(join(OUT, file), await doc.save());
  rows.push({ inv, ticket: t.id, category: t.category, contractor: t.contractor, total, payDate: iso(payDate), file });
}

// ---------- insurance schedule ----------
const premium = insurance?.actual_gbp ?? 0;
const policyNo = `AMI/PB/${String(hash(BUILDING_ID + fye) % 900000 + 100000)}`;
const periodEnd = fyEnd;
{
  const { page, doc, text, right, hr, font } = await newDoc(`Buildings Insurance Schedule ${policyNo}`);
  const W = A4[0];
  let y = A4[1] - M;
  text(INSURER, M, y, { size: 14, bold: true, color: ACCENT });
  right("Policy Schedule", W - M, y, { size: 11, color: GREY });
  y -= 14;
  text("1 Threadneedle Court, London EC2R 8AY  |  Authorised by the PRA, regulated by the FCA and PRA", M, y, { size: 8, color: GREY });
  y -= 36;
  text("Buildings Insurance Schedule", M, y, { size: 20, bold: true });
  y -= 18;
  hr(y);
  y -= 22;
  const sumInsured = Math.round((building.unit_count ?? 38) * 245000 / 10000) * 10000;
  const fields = [
    ["Policy number", policyNo],
    ["Policyholder", `${billTo} c/o Block Management Team`],
    ["Insured property", siteLine],
    ["Description", `${building.storeys}-storey residential block of ${building.unit_count} flats, built ${building.built_year}`],
    ["Period of insurance", `${ukDate(new Date(periodStart))} to ${ukDate(periodEnd)} (both days inclusive)`],
    ["Cover", "Buildings - All Risks, Property Owners' Liability, Terrorism"],
    ["Sum insured (buildings)", gbp(sumInsured)],
    ["Property owners' liability", gbp(10000000) + " any one occurrence"],
    ["Excess", "£250 each and every claim; £1,000 escape of water; £2,500 subsidence"],
    ["Annual premium (incl. IPT)", gbp(premium)],
    ["Insurance Premium Tax", "Included at 12%"],
    ["Broker", "—"],
  ];
  for (const [k, v] of fields) {
    text(k, M, y, { bold: true, size: 10 });
    const lines = wrap(v, font, 10, W - M - 220);
    lines.forEach((l, i) => text(l, 220, y - i * 13, { size: 10 }));
    y -= Math.max(1, lines.length) * 13 + 9;
  }
  y -= 10;
  hr(y);
  y -= 18;
  for (const l of wrap(
    "This schedule forms part of the policy and must be read together with the policy wording and any endorsements. Please check the details carefully and tell us immediately if anything is incorrect.",
    font, 9, W - 2 * M,
  )) {
    text(l, M, y, { size: 9, color: GREY });
    y -= 12;
  }
  text("Demo document generated for the Cortile hackathon. Not a real insurance schedule.", M, 60, { size: 8, color: GREY });
  writeFileSync(join(OUT, `insurance-schedule-${fyEnd.getUTCFullYear()}.pdf`), await doc.save());
}

// ---------- bank statement CSV ----------
const acctName = "Fir House Client Account";
const bank = [];
for (const r of rows)
  bank.push([r.payDate, -r.total, r.contractor.toUpperCase(), BUILDING_ID, acctName, r.inv]);
bank.push([iso(addDays(new Date(periodStart), 6)), -premium, "ALBION MUTUAL INSURANCE", BUILDING_ID, acctName, policyNo]);
const scDates = [iso(addDays(new Date(periodStart), 2)), iso(addDays(new Date(periodStart), 184))];
for (const d of scDates)
  for (const flat of [3, 7, 12, 21])
    bank.push([d, 1450 + (flat % 5) * 85, `FLAT ${flat} SERVICE CHARGE`, BUILDING_ID, acctName, `SC FIR HSE FLAT ${flat}`]);
for (let m = 0; m < 12; m += 3)
  bank.push([iso(addDays(new Date(periodStart), m * 30 + 27)), -12.5, "BANK CHARGES", BUILDING_ID, acctName, "ACCOUNT FEE"]);
bank.push([iso(addDays(new Date(periodStart), 40)), 1620, "FLAT 2 SERVICE CHARGE", "bld_0001", "Other Block Client Account", "SC FLAT 2"]);
bank.push([iso(addDays(new Date(periodStart), 95)), -642.3, "ACME DRAINAGE LTD", "bld_0001", "Other Block Client Account", "INV-55102"]);
bank.push([iso(addDays(new Date(periodStart), 120)), -12.5, "BANK CHARGES", "bld_0001", "Other Block Client Account", "ACCOUNT FEE"]);
bank.sort((a, b) => a[0].localeCompare(b[0]));
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const csv = ["date,amount,payee,building,account,reference"]
  .concat(bank.map((r) => [r[0], Number(r[1]).toFixed(2), ...r.slice(2)].map(csvCell).join(",")))
  .join("\n") + "\n";
writeFileSync(join(ROOT, "data/bank-transactions.csv"), csv);

writeFileSync(
  join(OUT, "README.txt"),
  "Demo evidence pack generated from Cortile ticket data for the hackathon demo. Not real invoices.\n",
);

console.log(`Building ${building.name} (${BUILDING_ID}); FY ending ${fye}; window ${periodStart}..${fye}`);
console.table(rows.map(({ file, ...r }) => r));
console.log(`Insurance premium ${gbp(premium)} (${policyNo}); bank rows: ${bank.length}`);
