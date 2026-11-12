import "server-only";

import { deleteCookie, readSealed, writeSealed } from "@/lib/sealed-cookie";

export const SESSION_COOKIE = "gmail_session";
export const STATE_COOKIE = "gmail_oauth_state";

export type GmailSession = {
  email: string;
  accessToken: string;
  refreshToken?: string;
  /** Unix ms when the access token expires */
  expiresAt: number;
};

export const readSession = () => readSealed<GmailSession>(SESSION_COOKIE);
export const writeSession = (session: GmailSession) =>
  writeSealed(SESSION_COOKIE, session);
export const clearSession = () => deleteCookie(SESSION_COOKIE);
