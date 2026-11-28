/**
 * Report date ranges in Pakistan time. Pure, so it is unit-tested with a
 * fixed "now".
 */
export const RANGE_PRESETS = ["today", "7d", "30d", "this-month", "last-month", "this-year"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number] | "custom";

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  custom: "Custom",
};

export interface ReportRange {
  preset: RangePreset;
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
  group: "day" | "month";
  label: string;
}

const MAX_DAYS = 1100;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Today's date (YYYY-MM-DD) in Asia/Karachi. */
export function karachiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(now);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !ISO.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Resolve ?range=…&from=…&to=…&group=… into a safe range. Unknown or broken
 * input falls back to the last 30 days; dates in the future are clamped.
 */
export function resolveRange(params: { range?: string; from?: string; to?: string; group?: string }, now = new Date()): ReportRange {
  const today = karachiToday(now);
  let preset: RangePreset = (RANGE_PRESETS as readonly string[]).includes(params.range ?? "") ? (params.range as RangePreset) : "30d";
  let from: string;
  let to = today;

  if (params.range === "custom" && validDate(params.from) && validDate(params.to)) {
    preset = "custom";
    from = params.from <= params.to ? params.from : params.to;
    to = params.from <= params.to ? params.to : params.from;
    if (to > today) to = today;
    if (from > to) from = to;
    if (daysBetween(from, to) > MAX_DAYS) from = addDays(to, -MAX_DAYS);
  } else {
    const [y, m] = today.split("-").map(Number);
    switch (preset) {
      case "today":
        from = today;
        break;
      case "7d":
        from = addDays(today, -6);
        break;
      case "this-month":
        from = `${today.slice(0, 7)}-01`;
        break;
      case "last-month": {
        const first = new Date(Date.UTC(y, m - 2, 1));
        from = first.toISOString().slice(0, 10);
        to = addDays(`${today.slice(0, 7)}-01`, -1);
        break;
      }
      case "this-year":
        from = `${y}-01-01`;
        break;
      default:
        preset = "30d";
        from = addDays(today, -29);
    }
  }

  const span = daysBetween(from, to);
  const group = params.group === "day" && span <= 92 ? "day" : params.group === "month" ? "month" : span > 62 ? "month" : "day";
  const label = preset === "custom" ? (from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`) : RANGE_LABELS[preset];
  return { preset, from, to, group, label };
}

/** Period label for a chart bar / table row. */
export function periodLabel(period: string, group: "day" | "month", short = false): string {
  const d = new Date(`${period.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-PK", group === "month" ? { month: short ? "short" : "long", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", ...(short ? {} : { weekday: "short" }), timeZone: "UTC" }).format(d);
}

/** Clean axis maximum and ticks (0, step, 2·step…). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1000];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
