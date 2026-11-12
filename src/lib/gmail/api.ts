import "server-only";

export type EmailSummary = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
};

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

type MessageMeta = {
  id: string;
  threadId: string;
  snippet: string;
  payload: { headers: { name: string; value: string }[] };
};

export async function listRecentEmails(
  accessToken: string,
  { max = 10, q = "" }: { max?: number; q?: string } = {},
): Promise<EmailSummary[]> {
  const params = new URLSearchParams({ maxResults: String(max) });
  if (q) params.set("q", q);

  const list = await gmailFetch<{ messages?: { id: string }[] }>(
    accessToken,
    `/messages?${params}`,
  );

  return Promise.all(
    (list.messages ?? []).map(async ({ id }) => {
      const msg = await gmailFetch<MessageMeta>(
        accessToken,
        `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      );
      const header = (name: string) =>
        msg.payload.headers.find(
          (h) => h.name.toLowerCase() === name.toLowerCase(),
        )?.value ?? "";
      return {
        id: msg.id,
        threadId: msg.threadId,
        from: header("From"),
        subject: header("Subject") || "(no subject)",
        date: header("Date"),
        snippet: msg.snippet,
      };
    }),
  );
}
