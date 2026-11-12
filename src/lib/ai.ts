import "server-only";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * All AI goes through OpenAI. The model only READS documents/emails (structured
 * extraction) and WRITES the owner reply. Matching and maths stay in code.
 */

export const AI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
export const aiEnabled = () => !!process.env.OPENAI_API_KEY;

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(
  messages: ChatMessage[],
  opts: { json?: object; maxTokens?: number } = {},
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        max_completion_tokens: opts.maxTokens ?? 4000,
        ...(AI_MODEL.startsWith("gpt-5") ? { reasoning_effort: "low" } : {}),
        ...(opts.json
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "extraction",
                  strict: true,
                  schema: opts.json,
                },
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      console.error(
        "[ai] OpenAI error",
        res.status,
        (await res.text()).slice(0, 300),
      );
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("[ai] request failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---- document / email extraction --------------------------------------------

export type Extracted = {
  doc_type:
    | "invoice"
    | "insurance_schedule"
    | "lease"
    | "management_agreement"
    | "bank_statement"
    | "other";
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null; // YYYY-MM-DD
  total_gbp: number | null;
  description: string | null;
  property_name: string | null;
  ticket_reference: string | null;
  premium_gbp: number | null;
  broker_name: string | null;
  broker_commission_disclosed: boolean | null;
  summary: string; // one sentence
};

const nullable = (type: string) => ({ type: [type, "null"] });
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "doc_type",
    "supplier_name",
    "invoice_number",
    "invoice_date",
    "total_gbp",
    "description",
    "property_name",
    "ticket_reference",
    "premium_gbp",
    "broker_name",
    "broker_commission_disclosed",
    "summary",
  ],
  properties: {
    doc_type: {
      type: "string",
      enum: [
        "invoice",
        "insurance_schedule",
        "lease",
        "management_agreement",
        "bank_statement",
        "other",
      ],
    },
    supplier_name: nullable("string"),
    invoice_number: nullable("string"),
    invoice_date: { ...nullable("string"), description: "YYYY-MM-DD" },
    total_gbp: {
      ...nullable("number"),
      description: "Gross total payable incl. VAT",
    },
    description: nullable("string"),
    property_name: nullable("string"),
    ticket_reference: {
      ...nullable("string"),
      description:
        "Customer/our reference such as a ticket id (e.g. tkt_012345)",
    },
    premium_gbp: nullable("number"),
    broker_name: nullable("string"),
    broker_commission_disclosed: nullable("boolean"),
    summary: { type: "string", description: "One factual sentence" },
  },
};

const EXTRACT_SYSTEM =
  "You extract facts from UK property-management documents (contractor invoices, insurance schedules, leases, management agreements, emails). Copy values exactly as written; never guess. Use null for anything not present. Dates as YYYY-MM-DD. Amounts as plain numbers in GBP. broker_commission_disclosed is true only if the document explicitly states a broker commission amount or percentage, false if it is an insurance document without one, null otherwise.";

// Cache by content hash so each document is only ever sent to the model once.
const CACHE_FILE = path.join(process.cwd(), "data", ".ai-extract-cache.json");
let cache: Record<string, Extracted> | null = null;
function loadCache() {
  if (cache) return cache;
  try {
    cache = existsSync(CACHE_FILE)
      ? (JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<
          string,
          Extracted
        >)
      : {};
  } catch {
    cache = {};
  }
  return cache;
}
function saveCache() {
  try {
    mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 1));
  } catch (e) {
    console.error("[ai] cache write failed", e);
  }
}

export async function extractFacts(
  text: string,
  kind: "pdf" | "email",
): Promise<Extracted | null> {
  if (!aiEnabled() || !text.trim()) return null;
  const clipped = text.slice(0, 12_000);
  const key = createHash("sha256")
    .update(`${AI_MODEL}|${clipped}`)
    .digest("hex");
  const c = loadCache();
  if (c[key]) return c[key];

  const out = await chat(
    [
      { role: "system", content: EXTRACT_SYSTEM },
      { role: "user", content: `Document type: ${kind}\n\n${clipped}` },
    ],
    { json: SCHEMA, maxTokens: 3000 },
  );
  if (!out) return null;
  try {
    const parsed = JSON.parse(out) as Extracted;
    c[key] = parsed;
    saveCache();
    return parsed;
  } catch {
    console.error("[ai] could not parse extraction JSON");
    return null;
  }
}

// ---- owner reply ----------------------------------------------------------------

const REPLY_SYSTEM =
  "You write plain-English service charge explanations for UK leaseholders. Use ONLY the evidence provided in the JSON; never invent amounts, invoices, dates, contractors or reasons. Lines with status not_found: say plainly that supporting evidence has not yet been located and that it is being requested. Lines with status partial: say what has been evidenced so far. Cite evidence by invoice number, ticket id and date. Do not do maths beyond the figures given. Focus on the biggest increases. Write a letter starting 'Dear Leaseholder,' and signed 'Block Management Team'. UK English, under 300 words.";

export async function writeOwnerReply(evidenceJson: unknown) {
  return chat(
    [
      { role: "system", content: REPLY_SYSTEM },
      { role: "user", content: JSON.stringify(evidenceJson) },
    ],
    { maxTokens: 4000 },
  );
}

// ---- service charge letter --------------------------------------------------------

const LETTER_SYSTEM =
  "You draft a UK leaseholder service charge statement. For each line, write 1-3 plain-English sentences explaining what the charge covers and why it changed, citing ONLY the evidence supplied (invoice numbers, ticket ids, dates, documents). For lines with status not_found, say that supporting evidence is still being obtained; never guess reasons (for example never say insurance market rates rose unless a supplied document says so). For partial lines, describe what has been evidenced so far. Do no maths except quoting figures given. Never invent amounts, invoices, dates, contractors or reasons. The intro is 2-3 sentences summarising the statement for the year. UK English, calm and professional. Return one entry per input line, using the same category value.";

const LETTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intro", "lines"],
  properties: {
    intro: { type: "string" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "explanation"],
        properties: {
          category: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
  },
};

export type LetterText = {
  intro: string;
  lines: { category: string; explanation: string }[];
};

export async function writeLetterText(
  evidenceJson: unknown,
): Promise<LetterText | null> {
  if (!aiEnabled()) return null;
  const out = await chat(
    [
      { role: "system", content: LETTER_SYSTEM },
      { role: "user", content: JSON.stringify(evidenceJson) },
    ],
    { json: LETTER_SCHEMA, maxTokens: 6000 },
  );
  if (!out) return null;
  try {
    const parsed = JSON.parse(out) as LetterText;
    if (typeof parsed.intro !== "string" || !Array.isArray(parsed.lines))
      return null;
    return parsed;
  } catch {
    console.error("[ai] could not parse letter JSON");
    return null;
  }
}
