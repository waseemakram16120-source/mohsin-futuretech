/**
 * Money as integer paisa — never floating point (payment spec §6.1).
 * Database amounts arrive as numeric strings such as "5998.00".
 */
export function toMinor(value: string | number): number {
  const text = typeof value === "number" ? value.toFixed(2) : value.trim();
  const m = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) throw new Error(`Invalid money amount: ${value}`);
  const minor = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error("Amount out of range");
  return minor;
}

/** 599800 → "5998.00" */
export function minorToDecimal(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error("Invalid minor amount");
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}
