import "server-only";

export type EmailEvidence = {
  id: string;
  threadId: string;
  from: string;
  date: string;
  subject: string;
  snippet: string;
  /** Full plain text (server only; used for AI extraction) */
  text?: string;
  amountsGbp: number[];
  invoiceNumbers: string[];
  attachments: {
    filename: string;
    mimeType: string;
    attachmentId: string;
    size: number;
  }[];
  link: string;
};

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

type Part = {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: Part[];
};
type FullMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: Part;
};

async function gmailGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return res.json() as Promise<T>;
}

const b64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function stripHtml(html: string) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&pound;/g, "£")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ");
}

function walk(
  part: Part,
  out: { plain: string[]; html: string[]; atts: EmailEvidence["attachments"] },
) {
  if (part.filename && part.body?.attachmentId) {
    out.atts.push({
      filename: part.filename,
      mimeType: part.mimeType ?? "application/octet-stream",
      attachmentId: part.body.attachmentId,
      size: part.body.size ?? 0,
    });
  } else if (part.body?.data) {
    if (part.mimeType === "text/plain") out.plain.push(b64(part.body.data));
    else if (part.mimeType === "text/html")
      out.html.push(stripHtml(b64(part.body.data)));
  }
  part.parts?.forEach((p) => walk(p, out));
}

export function extractAmountsGbp(text: string): number[] {
  const found = new Set<number>();
  const re =
    /(?:£|GBP\s?|total[^\d£]{0,15}|amount[^\d£]{0,15}|due[^\d£]{0,15})\s?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) found.add(n);
  }
  return [...found];
}

export function extractInvoiceNumbers(text: string): string[] {
  const found = new Set<string>();
  const re = /\b(?:invoice|inv)[\s#:no.]*([A-Z0-9][A-Z0-9\-/]{2,})/gi;
  for (const m of text.matchAll(re)) {
    const v = m[1].replace(/[-/]+$/, "");
    if (/\d/.test(v)) found.add(v);
  }
  return [...found];
}

function toEvidence(msg: FullMessage): EmailEvidence {
  const headers = msg.payload?.headers ?? [];
  const h = (n: string) =>
    headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
  const out = {
    plain: [] as string[],
    html: [] as string[],
    atts: [] as EmailEvidence["attachments"],
  };
  if (msg.payload) walk(msg.payload, out);
  const body = (out.plain.length ? out.plain : out.html).join("\n");
  const subject = h("Subject") || "(no subject)";
  const text = `${subject}\n${msg.snippet ?? ""}\n${body}\n${out.atts
    .map((a) => a.filename)
    .join("\n")}`;
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: h("From"),
    date: h("Date"),
    subject,
    snippet: msg.snippet ?? "",
    text,
    amountsGbp: extractAmountsGbp(text),
    invoiceNumbers: extractInvoiceNumbers(text),
    attachments: out.atts,
    link: `https://mail.google.com/mail/u/0/#all/${msg.threadId}`,
  };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function searchEmailEvidence(
  accessToken: string,
  query: string,
  max = 15,
): Promise<EmailEvidence[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(max) });
  const list = await gmailGet<{ messages?: { id: string }[] }>(
    accessToken,
    `/messages?${params}`,
  );
  const ids = [...new Set((list.messages ?? []).map((m) => m.id))];
  const settled = await mapLimit(ids, 5, async (id) => {
    try {
      return toEvidence(
        await gmailGet<FullMessage>(accessToken, `/messages/${id}?format=full`),
      );
    } catch {
      return null;
    }
  });
  return settled.filter((e): e is EmailEvidence => e !== null);
}

const q = (s: string) => `"${s.replace(/"/g, "")}"`;
const ymd = (d: string | Date) => {
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getUTCFullYear()}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${String(dt.getUTCDate()).padStart(2, "0")}`;
};

export function buildGmailQuery(opts: {
  building?: string;
  postcode?: string;
  contractor?: string;
  invoiceNumbers?: string[];
  after?: string | Date;
  before?: string | Date;
}): string {
  const parts: string[] = [];
  const terms = [opts.building, opts.postcode]
    .filter((x): x is string => !!x?.trim())
    .map((x) => q(x.trim()));
  if (terms.length) parts.push(`(${terms.join(" OR ")})`);
  if (opts.contractor?.trim()) parts.push(q(opts.contractor.trim()));
  const invs = (opts.invoiceNumbers ?? [])
    .filter((x) => x?.trim())
    .map((x) => q(x.trim()));
  if (invs.length) parts.push(`(${invs.join(" OR ")})`);
  else if (!opts.contractor?.trim()) parts.push(`(invoice OR receipt OR "£")`);
  const a = opts.after ? ymd(opts.after) : "";
  const b = opts.before ? ymd(opts.before) : "";
  if (a) parts.push(`after:${a}`);
  if (b) parts.push(`before:${b}`);
  return parts.join(" ");
}

/** Download a PDF attachment and return its text (for invoices sent as attachments). */
export async function attachmentPdfText(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data?: string };
    if (!data) return null;
    const bytes = Buffer.from(
      data.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    return (await extractText(pdf, { mergePages: true })).text;
  } catch (e) {
    console.error(
      "[gmail] attachment read failed",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
