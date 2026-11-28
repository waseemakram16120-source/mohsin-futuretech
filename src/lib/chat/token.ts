/**
 * Guest chat access: the cookie holds "<conversation id>.<random token>";
 * the database stores only the token's SHA-256. Pure (unit-tested).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CHAT_COOKIE = "mft_chat";
export const CHAT_COOKIE_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

export function newGuestToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function packCookie(conversationId: string, token: string): string {
  return `${conversationId}.${token}`;
}

export function unpackCookie(value: string | undefined | null): { conversationId: string; token: string } | null {
  if (!value) return null;
  const m = value.match(/^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/);
  return m ? { conversationId: m[1], token: m[2] } : null;
}

/** Constant-time comparison of a token against a stored hash. */
export function tokenMatches(token: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !/^[0-9a-f]{64}$/.test(storedHash)) return false;
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
