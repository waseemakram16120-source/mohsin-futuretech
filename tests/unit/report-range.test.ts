import { describe, expect, it } from "vitest";
import { karachiToday, periodLabel, resolveRange } from "@/lib/admin/report-range";

// 28 Nov 2026, 20:30 UTC = 29 Nov 2026, 01:30 in Karachi.
const NOW = new Date("2026-11-28T20:30:00Z");

describe("report ranges (Pakistan time)", () => {
  it("uses the Karachi calendar day", () => {
    expect(karachiToday(NOW)).toBe("2026-11-29");
    expect(karachiToday(new Date("2026-11-28T18:59:00Z"))).toBe("2026-11-28");
  });

  it("presets", () => {
    expect(resolveRange({ range: "today" }, NOW)).toMatchObject({ from: "2026-11-29", to: "2026-11-29", group: "day" });
    expect(resolveRange({ range: "7d" }, NOW)).toMatchObject({ from: "2026-11-23", to: "2026-11-29" });
    expect(resolveRange({}, NOW)).toMatchObject({ preset: "30d", from: "2026-10-31", to: "2026-11-29", group: "day" });
    expect(resolveRange({ range: "this-month" }, NOW)).toMatchObject({ from: "2026-11-01", to: "2026-11-29" });
    expect(resolveRange({ range: "last-month" }, NOW)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolveRange({ range: "this-year" }, NOW)).toMatchObject({ from: "2026-01-01", to: "2026-11-29", group: "month" });
    expect(resolveRange({ range: "last-month" }, new Date("2026-01-15T10:00:00Z"))).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("custom ranges are validated, ordered and clamped", () => {
    expect(resolveRange({ range: "custom", from: "2026-11-10", to: "2026-11-01" }, NOW)).toMatchObject({ from: "2026-11-01", to: "2026-11-10", label: "1 Nov 2026 – 10 Nov 2026" });
    expect(resolveRange({ range: "custom", from: "2026-11-20", to: "2027-05-01" }, NOW)).toMatchObject({ to: "2026-11-29" });
    expect(resolveRange({ range: "custom", from: "2026-02-30", to: "2026-03-01" }, NOW).preset).toBe("30d");
    expect(resolveRange({ range: "custom", from: "2020-01-01", to: "2026-11-29" }, NOW).from).toBe("2023-11-25"); // 1100 days back (2024 is a leap year)
    expect(resolveRange({ range: "bogus" }, NOW).preset).toBe("30d");
  });

  it("grouping: daily for short ranges, monthly for long ones, override allowed", () => {
    expect(resolveRange({ range: "30d", group: "month" }, NOW).group).toBe("month");
    expect(resolveRange({ range: "this-year", group: "day" }, NOW).group).toBe("month"); // too many days
    expect(resolveRange({ range: "custom", from: "2026-09-01", to: "2026-11-29" }, NOW).group).toBe("month");
  });

  it("labels", () => {
    expect(periodLabel("2026-11-05", "month")).toBe("November 2026");
    expect(periodLabel("2026-11-05", "day", true)).toBe("5 Nov");
  });
});
