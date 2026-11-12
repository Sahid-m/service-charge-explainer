import "server-only";

import { extractFacts, type Extracted } from "@/lib/ai";
import { attachmentPdfText, type EmailEvidence } from "@/lib/gmail/evidence";

/**
 * AI reads the document/email and returns structured facts. We merge those
 * facts into the evidence record; the matcher then does all matching in code.
 */
export function applyFacts(e: EmailEvidence, f: Extracted | null) {
  if (!f) return e;
  const amounts = [
    ...(f.total_gbp != null ? [f.total_gbp] : []),
    ...(f.premium_gbp != null ? [f.premium_gbp] : []),
    ...e.amountsGbp,
  ];
  const invoices = [
    ...(f.invoice_number ? [f.invoice_number] : []),
    ...e.invoiceNumbers,
  ];
  return {
    ...e,
    from: f.supplier_name || e.from,
    date: f.invoice_date ? new Date(f.invoice_date).toISOString() : e.date,
    amountsGbp: [...new Set(amounts.map((a) => Math.round(a * 100) / 100))],
    invoiceNumbers: [...new Set(invoices)],
    facts: f,
  } satisfies EmailEvidence & { facts: Extracted };
}

/** AI-read a Gmail message, including any PDF attachments (max 2). */
export async function enrichEmail(token: string, e: EmailEvidence) {
  let text = e.text ?? `${e.subject}\n${e.snippet}`;
  const pdfs = e.attachments
    .filter((a) => a.mimeType === "application/pdf" && a.attachmentId)
    .slice(0, 2);
  for (const a of pdfs) {
    const t = await attachmentPdfText(token, e.id, a.attachmentId);
    if (t) text += `\n\n--- Attachment ${a.filename} ---\n${t}`;
  }
  return applyFacts(e, await extractFacts(text, "email"));
}
