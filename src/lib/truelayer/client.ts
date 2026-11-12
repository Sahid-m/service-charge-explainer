import "server-only";

import { cookies } from "next/headers";

import { deleteCookie, unseal, writeSealed } from "@/lib/sealed-cookie";

/**
 * TrueLayer Data API (read-only Open Banking): accounts, cards, balances, transactions.
 * Docs: https://docs.truelayer.com/docs/data-api-basics
 *
 * Each connected bank ("connection") is stored in its own encrypted cookie,
 * `tl_conn_<credentialsId>`, so several banks can be connected without a database.
 */

export const STATE_COOKIE = "truelayer_oauth_state";
const CONN_PREFIX = "tl_conn_";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 90; // TrueLayer consent lasts 90 days

export const DATA_SCOPES = [
  "info",
  "accounts",
  "balance",
  "cards",
  "transactions",
  "offline_access", // gives a refresh token
];

export type Connection = {
  credentialsId: string;
  provider: { id: string; name: string; logo?: string };
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  connectedAt: number;
};

type TrueLayerEnv = "sandbox" | "live";

/**
 * TRUELAYER_ENV picks which credentials are used:
 *   sandbox → TRUELAYER_SANDBOX_CLIENT_ID / TRUELAYER_SANDBOX_CLIENT_SECRET
 *   live    → TRUELAYER_LIVE_CLIENT_ID / TRUELAYER_LIVE_CLIENT_SECRET
 * Defaults to sandbox.
 */
function config() {
  const env: TrueLayerEnv =
    process.env.TRUELAYER_ENV === "live" ? "live" : "sandbox";
  const prefix = `TRUELAYER_${env.toUpperCase()}`;
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) {
    throw new Error(`${prefix}_CLIENT_ID / ${prefix}_CLIENT_SECRET not set`);
  }
  const sandbox = env === "sandbox";
  const domain = sandbox ? "truelayer-sandbox.com" : "truelayer.com";
  return {
    env,
    clientId,
    clientSecret,
    sandbox,
    authBase: `https://auth.${domain}`,
    apiBase: `https://api.${domain}/data/v1`,
  };
}

export function redirectUri(requestOrigin: string) {
  const base = process.env.APP_URL?.replace(/\/$/, "") || requestOrigin;
  return `${base}/api/auth/truelayer/callback`;
}

export function buildAuthUrl(state: string, requestOrigin: string) {
  const { clientId, authBase, sandbox } = config();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri(requestOrigin),
    scope: DATA_SCOPES.join(" "),
    // uk-cs-mock = TrueLayer's "Mock Bank" (sandbox only, login john / doe)
    providers: sandbox
      ? "uk-cs-mock uk-ob-all uk-oauth-all"
      : "uk-ob-all uk-oauth-all",
    state,
  });
  return `${authBase}/?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

async function tokenRequest(body: Record<string, string>) {
  const { clientId, clientSecret, authBase } = config();
  const res = await fetch(`${authBase}/connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      ...body,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `TrueLayer token request failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as TokenResponse;
}

export class TrueLayerError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** GET a Data API path and return its `results` array. */
async function dataGet<T>(
  accessToken: string,
  path: string,
  psuIp?: string,
): Promise<T[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  // Tells the bank the user is present, which avoids the 4-calls-a-day
  // limit some banks apply to unattended access.
  if (psuIp) headers["X-PSU-IP"] = psuIp;

  const res = await fetch(`${config().apiBase}${path}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new TrueLayerError(res.status, `${path}: ${await res.text()}`);
  }
  const json = (await res.json()) as { results: T[] };
  return json.results ?? [];
}

// ---- connection cookies -------------------------------------------------

// Cookies are namespaced per environment so sandbox and live connections never mix.
const envPrefix = () => `${CONN_PREFIX}${config().env}_`;
const cookieName = (credentialsId: string) =>
  `${envPrefix()}${credentialsId.replace(/[^A-Za-z0-9_-]/g, "")}`;

export async function readConnections(): Promise<Connection[]> {
  let prefix: string;
  try {
    prefix = envPrefix();
  } catch {
    return []; // TrueLayer not configured
  }
  const all = (await cookies()).getAll();
  const conns = await Promise.all(
    all
      .filter((c) => c.name.startsWith(prefix))
      .map((c) => unseal<Connection>(c.value)),
  );
  return conns
    .filter((c): c is Connection => !!c)
    .sort((a, b) => a.connectedAt - b.connectedAt);
}

const saveConnection = (conn: Connection) =>
  writeSealed(cookieName(conn.credentialsId), conn, CONSENT_MAX_AGE);

export async function removeConnection(credentialsId: string) {
  const conn = (await readConnections()).find(
    (c) => c.credentialsId === credentialsId,
  );
  if (conn) {
    // Revoke the consent at TrueLayer (best effort)
    await fetch(`${config().authBase}/api/delete`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${conn.accessToken}` },
    }).catch(() => {});
  }
  await deleteCookie(cookieName(credentialsId));
}

// ---- OAuth ----------------------------------------------------------------

export async function exchangeCode(code: string, requestOrigin: string) {
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(requestOrigin),
  });

  type Me = {
    credentials_id: string;
    provider: { provider_id: string; display_name: string; logo_uri?: string };
  };
  const [me] = await dataGet<Me>(tokens.access_token, "/me");
  if (!me) throw new Error("TrueLayer /me returned no connection info");

  const conn: Connection = {
    credentialsId: me.credentials_id,
    provider: {
      id: me.provider.provider_id,
      name: me.provider.display_name,
      logo: me.provider.logo_uri,
    },
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    connectedAt: Date.now(),
  };
  await saveConnection(conn);
  return conn;
}

/** Returns a connection with a valid access token, refreshing and re-saving if needed. */
export async function ensureFresh(conn: Connection): Promise<Connection> {
  if (Date.now() < conn.expiresAt - 60_000) return conn;
  if (!conn.refreshToken) throw new TrueLayerError(401, "reconnect_required");

  let tokens: TokenResponse;
  try {
    tokens = await tokenRequest({
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
    });
  } catch {
    // Usually the 90-day consent has expired or was revoked at the bank
    throw new TrueLayerError(401, "reconnect_required");
  }
  const fresh: Connection = {
    ...conn,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? conn.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  await saveConnection(fresh);
  return fresh;
}

// ---- data -------------------------------------------------------------------

export type AccountKind = "account" | "card";

export type BankAccount = {
  id: string;
  kind: AccountKind;
  name: string;
  type: string;
  currency: string;
  /** Last 4 digits only */
  mask?: string;
  balance?: { current: number; available?: number; currency: string };
};

type RawAccount = {
  account_id: string;
  account_type: string;
  display_name: string;
  currency: string;
  account_number?: { number?: string; iban?: string };
};
type RawCard = {
  account_id: string;
  card_type: string;
  display_name: string;
  currency: string;
  partial_card_number?: string;
};
type RawBalance = { current: number; available?: number; currency: string };

/** Some banks don't support every endpoint (501/404) — treat as empty. */
async function optional<T>(p: Promise<T[]>): Promise<T[]> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof TrueLayerError && [400, 403, 404, 501].includes(e.status))
      return [];
    throw e;
  }
}

export async function listAccounts(
  conn: Connection,
  psuIp?: string,
): Promise<BankAccount[]> {
  const [accounts, cards] = await Promise.all([
    optional(dataGet<RawAccount>(conn.accessToken, "/accounts", psuIp)),
    optional(dataGet<RawCard>(conn.accessToken, "/cards", psuIp)),
  ]);

  const withBalance = async (
    base: Omit<BankAccount, "balance">,
  ): Promise<BankAccount> => {
    const path = `/${base.kind === "card" ? "cards" : "accounts"}/${base.id}/balance`;
    const [balance] = await optional(
      dataGet<RawBalance>(conn.accessToken, path, psuIp),
    );
    return { ...base, balance };
  };

  return Promise.all([
    ...accounts.map((a) =>
      withBalance({
        id: a.account_id,
        kind: "account",
        name: a.display_name,
        type: a.account_type,
        currency: a.currency,
        mask: (a.account_number?.number ?? a.account_number?.iban)?.slice(-4),
      }),
    ),
    ...cards.map((c) =>
      withBalance({
        id: c.account_id,
        kind: "card",
        name: c.display_name,
        type: c.card_type,
        currency: c.currency,
        mask: c.partial_card_number?.slice(-4),
      }),
    ),
  ]);
}

export type Transaction = {
  id: string;
  timestamp: string;
  description: string;
  merchant?: string;
  amount: number;
  currency: string;
  category?: string;
};

type RawTransaction = {
  transaction_id: string;
  timestamp: string;
  description: string;
  merchant_name?: string;
  amount: number;
  currency: string;
  transaction_category?: string;
};

export async function listTransactions(
  conn: Connection,
  {
    accountId,
    kind,
    from,
    to,
  }: {
    accountId: string;
    kind: AccountKind;
    from: string;
    to: string;
  },
  psuIp?: string,
): Promise<Transaction[]> {
  const params = new URLSearchParams({ from, to });
  const path = `/${kind === "card" ? "cards" : "accounts"}/${encodeURIComponent(accountId)}/transactions?${params}`;
  const raw = await dataGet<RawTransaction>(conn.accessToken, path, psuIp);
  return raw
    .map((t) => ({
      id: t.transaction_id,
      timestamp: t.timestamp,
      description: t.description,
      merchant: t.merchant_name,
      amount: t.amount,
      currency: t.currency,
      category: t.transaction_category,
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
