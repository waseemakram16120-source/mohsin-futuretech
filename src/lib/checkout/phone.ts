/**
 * Pakistani mobile numbers. Mirrors public.normalize_pk_phone() in the
 * database (tests/db/phone-parity.test.ts keeps them identical).
 */

/** 0300-1234567, +92 300 1234567, 923001234567, 3001234567 → 03001234567; else null. */
export function normalizePkPhone(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  if (/^03\d{9}$/.test(d)) return d;
  if (/^923\d{9}$/.test(d)) return `0${d.slice(2)}`;
  if (/^3\d{9}$/.test(d)) return `0${d}`;
  return null;
}

/** 03001234567 → "0300 1234567" for display. */
export function formatPkPhone(phone: string): string {
  const n = normalizePkPhone(phone);
  return n ? `${n.slice(0, 4)} ${n.slice(4)}` : phone;
}
