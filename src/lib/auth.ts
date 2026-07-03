import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Single-practitioner auth: credentials checked against env
// (PRACTITIONER_EMAIL + PRACTITIONER_PASSWORD_HASH, bcrypt), session is a
// signed JWT in an httpOnly cookie. AUTH_SECRET signs the JWT.
const COOKIE = "oc_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createSession(email: string) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_S,
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Returns the practitioner email if a valid session cookie exists, else null. */
export async function getSession(): Promise<{ email: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return { email: payload.email as string };
  } catch {
    return null;
  }
}

/** Edge-safe verify for middleware (no next/headers). */
export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE = COOKIE;
