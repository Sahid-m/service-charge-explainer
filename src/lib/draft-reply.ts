import "server-only";

import { writeOwnerReply } from "./ai";
import type {
  EvidenceChain,
  ExplainedLine,
  ExplainResult,
} from "./explain-types";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});
const money = (n: number) => gbp.format(n);
const date = (d: string) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime())
    ? d
    : t.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};
const absChange = (l: ExplainedLine) => Math.abs(l.changeGbp ?? 0);

function chainText(c: EvidenceChain): string {
  const parts: string[] = [];
  if (c.ticket) {
    const who = c.ticket.contractor ? ` by ${c.ticket.contractor}` : "";
    parts.push(
      `maintenance ticket ${c.ticket.id} ("${c.ticket.title}", ${date(c.ticket.date)}${who})`,
    );
  }
  if (c.email) {
    const inv = c.email.invoiceNumbers[0];
    const from = c.email.from ? ` from ${c.email.from}` : "";
    parts.push(
      `${inv ? `invoice ${inv}` : `email "${c.email.subject}"`}${from} dated ${date(c.email.date)}`,
    );
  }
  if (c.payment) {
    parts.push(`paid on ${date(c.payment.date)} to ${c.payment.payee}`);
  }
  return `${money(c.amountGbp)}: ${parts.join(", ")}`;
}

function lineText(l: ExplainedLine): string {
  const prev = l.prevGbp == null ? "no previous figure" : money(l.prevGbp);
  const pct =
    l.changePct == null
      ? ""
      : ` (${l.changePct > 0 ? "+" : ""}${l.changePct.toFixed(1)}%)`;
  const head = `${l.label}: ${prev} to ${money(l.currGbp)}${pct}.`;
  const increase = (l.changeGbp ?? 0) > 0;
  const bits: string[] = [];
  if (l.chains.length) {
    bits.push(
      `Supporting evidence found: ${l.chains.map(chainText).join("; ")}.`,
    );
  }
  if (l.uncostedTickets.length) {
    bits.push(
      `Related tickets without a recorded cost: ${l.uncostedTickets.map((t) => t.id).join(", ")}.`,
    );
  }
  if (l.docs.length) {
    bits.push(`Relevant documents: ${l.docs.map((d) => d.name).join(", ")}.`);
  }
  if (l.status === "not_found" && increase) {
    bits.push(
      "We have not yet located supporting evidence for this increase and are requesting it from the broker/contractor.",
    );
  } else if (l.status === "partial" && increase) {
    bits.push(
      `So far this evidence accounts for ${money(l.explainedGbp)} of the increase; we are seeking the remainder.`,
    );
  }
  return [head, ...bits].join(" ");
}

export function templateReply(r: ExplainResult): string {
  const { prevGbp, currGbp } = r.totals;
  const out: string[] = ["Dear Leaseholder,", ""];
  if (prevGbp == null) {
    out.push(
      `The service charge for ${r.building.name} for ${r.years.curr} is ${money(currGbp)}. No previous-year figure is available for comparison.`,
    );
  } else {
    const diff = currGbp - prevGbp;
    const pct = prevGbp
      ? ` (${diff >= 0 ? "+" : ""}${((diff / prevGbp) * 100).toFixed(1)}%)`
      : "";
    const dir = diff >= 0 ? "increased" : "decreased";
    out.push(
      `The service charge for ${r.building.name} has ${dir} from ${money(prevGbp)}${r.years.prev ? ` (${r.years.prev})` : ""} to ${money(currGbp)} (${r.years.curr}), a change of ${diff >= 0 ? "+" : "-"}${money(Math.abs(diff))}${pct}.`,
    );
  }
  const movers = [...r.lines]
    .filter((l) => l.changeGbp != null && l.changeGbp !== 0)
    .sort((a, b) => absChange(b) - absChange(a))
    .slice(0, 5);
  if (movers.length) {
    out.push("", "The main changes are:", "");
    movers.forEach((l, i) => out.push(`${i + 1}. ${lineText(l)}`, ""));
  }
  out.push(
    "Please contact us if you would like to see any of the supporting documents.",
    "",
    "Kind regards,",
    "Block Management Team",
  );
  return out.join("\n");
}

function compact(r: ExplainResult) {
  return {
    building: r.building.name,
    years: r.years,
    totals: r.totals,
    lines: r.lines.map((l) => ({
      category: l.label,
      prev: l.prevGbp,
      curr: l.currGbp,
      change: l.changeGbp,
      status: l.status,
      coverage: l.coveragePct,
      evidence: l.chains.map((c) => ({
        amount: c.amountGbp,
        ticket: c.ticket && {
          id: c.ticket.id,
          title: c.ticket.title,
          date: c.ticket.date,
          cost: c.ticket.costGbp,
          contractor: c.ticket.contractor,
        },
        email: c.email && {
          subject: c.email.subject,
          invoiceNumbers: c.email.invoiceNumbers,
          amounts: c.email.amountsGbp,
          date: c.email.date,
        },
        payment: c.payment && {
          date: c.payment.date,
          amount: c.payment.amountGbp,
          payee: c.payment.payee,
        },
      })),
      uncostedTickets: l.uncostedTickets.map((t) => ({
        id: t.id,
        title: t.title,
        date: t.date,
      })),
      docs: l.docs.map((d) => ({ name: d.name, summary: d.summary })),
    })),
  };
}

/** Owner reply written by OpenAI (see src/lib/ai.ts), citing only found evidence. */
export async function llmReply(r: ExplainResult): Promise<string | null> {
  return writeOwnerReply(compact(r));
}
