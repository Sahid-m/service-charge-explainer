import "server-only";

import { writeSession, type GmailSession } from "./session";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];

function env(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Use APP_URL if set, otherwise the origin the request came in on. */
export function redirectUri(requestOrigin: string) {
  const base = process.env.APP_URL?.replace(/\/$/, "") || requestOrigin;
  return `${base}/api/auth/google/callback`;
}

export function buildAuthUrl(state: string, requestOrigin: string) {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(requestOrigin),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline", // get a refresh token
    prompt: "consent", // always return a refresh token
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
};

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      ...body,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Google token request failed: ${res.status} ${await res.text()}`,
    );
  }
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(code: string, requestOrigin: string) {
  const tokens = await tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(requestOrigin),
  });

  if (!tokens.scope.includes("gmail.readonly")) {
    throw new Error("Gmail permission was not granted");
  }

  const profile = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  ).then((r) => r.json() as Promise<{ emailAddress: string }>);

  const session: GmailSession = {
    email: profile.emailAddress,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  await writeSession(session);
  return session;
}

/** Returns a session with a valid access token, refreshing (and re-saving) if needed. */
export async function ensureFreshSession(session: GmailSession) {
  if (Date.now() < session.expiresAt - 60_000) return session;
  if (!session.refreshToken)
    throw new Error("Session expired, reconnect Gmail");

  const tokens = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: session.refreshToken,
  });
  const fresh: GmailSession = {
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
  await writeSession(fresh);
  return fresh;
}

export async function revokeToken(token: string) {
  await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    {
      method: "POST",
    },
  ).catch(() => {});
}
