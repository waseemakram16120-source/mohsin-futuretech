import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHANUM = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

/** Unguessable, opaque payment reference (A–Z/2–9), via rejection-free 32-char alphabet. */
export function secureReference(length = 20): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHANUM[bytes[i] & 31];
  return out;
}

/** Constant-time string comparison (different lengths → false, still constant for equal length). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) {
    timingSafeEqual(x, x); // keep timing similar
    return false;
  }
  return timingSafeEqual(x, y);
}

export function hmacSha256Hex(key: string, data: string): string {
  return createHmac("sha256", key).update(data, "utf8").digest("hex");
}

export function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}
