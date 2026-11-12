import "server-only";

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { extractText, getDocumentProxy } from "unpdf";

import { extractFacts, type Extracted } from "@/lib/ai";
import { applyFacts } from "@/lib/enrich";
import type { EmailEvidence } from "@/lib/gmail/evidence";
import { extractAmountsGbp, extractInvoiceNumbers } from "@/lib/gmail/evidence";

/**
 * Real PDF documents for a building, read from data/docs/<buildingId>/.
 * Text is extracted from the PDF (no LLM) and parsed for amounts, invoice
 * numbers, dates and ticket references.
 */

export type LocalDoc = {
  file: string;
  kind: "invoice" | "insurance" | "lease" | "management_agreement" | "other";
  text: string;
  link: string;
  /** Structured facts read by AI (null if AI not configured) */
  facts: Extracted | null;
};

const DOCS_DIR = path.join(process.cwd(), "data", "docs");
const cache = new Map<string, { mtime: number; text: string }>();

async function pdfText(file: string) {
  const mtime = statSync(file).mtimeMs;
  const hit = cache.get(file);
  if (hit && hit.mtime === mtime) return hit.text;
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
  const { text } = await extractText(pdf, { mergePages: true });
  cache.set(file, { mtime, text });
  return text;
}

function classify(name: string, text: string): LocalDoc["kind"] {
  const s = `${name} ${text.slice(0, 400)}`.toLowerCase();
  if (s.includes("insurance")) return "insurance";
  if (s.includes("management agreement")) return "management_agreement";
  if (s.includes("lease")) return "lease";
  if (s.includes("invoice")) return "invoice";
  return "other";
}

function kindFromFacts(
  f: Extracted,
  name: string,
  text: string,
): LocalDoc["kind"] {
  switch (f.doc_type) {
    case "invoice":
      return "invoice";
    case "insurance_schedule":
      return "insurance";
    case "lease":
      return "lease";
    case "management_agreement":
      return "management_agreement";
    default:
      return classify(name, text);
  }
}

export async function listLocalDocs(buildingId: string): Promise<LocalDoc[]> {
  const safeId = buildingId.replace(/[^A-Za-z0-9_-]/g, "");
  const dir = path.join(DOCS_DIR, safeId);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) =>
    f.toLowerCase().endsWith(".pdf"),
  );
  const docs = await Promise.all(
    files.map(async (f) => {
      try {
        const text = await pdfText(path.join(dir, f));
        const facts = await extractFacts(text, "pdf");
        return {
          file: f,
          facts,
          kind: facts ? kindFromFacts(facts, f, text) : classify(f, text),
          text,
          link: `/api/docs/${safeId}/${encodeURIComponent(f)}`,
        } satisfies LocalDoc;
      } catch (e) {
        console.error(`[local-docs] could not read ${f}`, e);
        return null;
      }
    }),
  );
  return docs.filter((d): d is LocalDoc => !!d);
}

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december";

function findDate(text: string): string | null {
  const labelled = text.match(
    new RegExp(
      `invoice date[:\\s]*(\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{4})`,
      "i",
    ),
  );
  const raw =
    labelled?.[1] ??
    text.match(new RegExp(`\\d{1,2}\\s+(?:${MONTHS})\\s+\\d{4}`, "i"))?.[0] ??
    text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!raw) return null;
  const uk = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const d = uk ? new Date(`${uk[3]}-${uk[2]}-${uk[1]}`) : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Turn invoice PDFs into the same shape as Gmail invoice evidence. */
export function invoiceEvidence(doc: LocalDoc): EmailEvidence | null {
  if (doc.kind !== "invoice") return null;
  const firstLine =
    doc.text
      .split(/\n|\s{2,}/)
      .map((l) => l.trim())
      .find((l) => l && !/^invoice$/i.test(l)) ?? doc.file;
  const base: EmailEvidence = {
    id: `pdf:${doc.file}`,
    threadId: "",
    from: firstLine.slice(0, 80),
    date: findDate(doc.text) ?? "",
    subject: doc.file,
    snippet: doc.text.slice(0, 200),
    amountsGbp: extractAmountsGbp(doc.text),
    invoiceNumbers: extractInvoiceNumbers(doc.text),
    attachments: [
      {
        filename: doc.file,
        mimeType: "application/pdf",
        attachmentId: "",
        size: 0,
      },
    ],
    link: doc.link,
  };
  return applyFacts(base, doc.facts);
}

/** Ticket ids (tkt_123456) mentioned in a document. */
export const ticketRefs = (text: string, facts?: Extracted | null) =>
  new Set([
    ...(text.match(/tkt_\d+/g) ?? []),
    ...(facts?.ticket_reference?.match(/tkt_\d+/g) ?? []),
  ]);

export function docPath(buildingId: string, file: string) {
  const safeId = buildingId.replace(/[^A-Za-z0-9_-]/g, "");
  const safeFile = path.basename(file);
  if (!safeFile.toLowerCase().endsWith(".pdf")) return null;
  const full = path.join(DOCS_DIR, safeId, safeFile);
  return existsSync(full) ? full : null;
}
