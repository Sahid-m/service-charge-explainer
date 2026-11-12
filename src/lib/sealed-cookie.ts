import "server-only";

import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

/** Encrypted, httpOnly cookies keyed off SESSION_SECRET. */

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return new Uint8Array(digest);
}

export async function unseal<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, await getKey());
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export async function readSealed<T>(name: string): Promise<T | null> {
  return unseal<T>((await cookies()).get(name)?.value);
}

/** Only callable from Route Handlers / Server Actions (cookies are writable there). */
export async function writeSealed(
  name: string,
  value: object,
  maxAge = MAX_AGE,
) {
  const token = await new EncryptJWT({ ...value })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .encrypt(await getKey());

  (await cookies()).set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function deleteCookie(name: string) {
  (await cookies()).delete(name);
}

/** Short-lived plain cookie used for the OAuth `state` CSRF check. */
export async function setStateCookie(name: string, state: string) {
  (await cookies()).set(name, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

/** Reads and clears the state cookie, returning whether it matched. */
export async function consumeStateCookie(name: string, state: string | null) {
  const store = await cookies();
  const expected = store.get(name)?.value;
  store.delete(name);
  return !!state && !!expected && state === expected;
}

const RETURN_TO_COOKIE = "oauth_return_to";

/** Only allow same-site relative paths (prevents open redirects). */
function safePath(p: string | null | undefined) {
  return p && p.startsWith("/") && !p.startsWith("//") && !p.includes("\\")
    ? p
    : null;
}

export async function setReturnTo(returnTo: string | null) {
  const store = await cookies();
  const path = safePath(returnTo);
  if (!path) {
    store.delete(RETURN_TO_COOKIE);
    return;
  }
  store.set(RETURN_TO_COOKIE, path, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

/** Where to send the user after OAuth: the stored returnTo, else "/app". */
export async function consumeReturnTo(origin: string) {
  const store = await cookies();
  const path = safePath(store.get(RETURN_TO_COOKIE)?.value) ?? "/app";
  store.delete(RETURN_TO_COOKIE);
  return new URL(path, origin);
}
