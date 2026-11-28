import { describe, expect, it } from "vitest";
import { reportSchema, reportToCsv } from "@/lib/admin/report-data";
import { niceTicks } from "@/lib/admin/report-range";

const raw = {
  from: "2025-01-10",
  to: "2025-01-11",
  group: "day",
  summary: { orders: 3, valid_orders: 2, sales: "5498.00", collected: 2249, avg_order_value: 2749, items_sold: 3, discounts: 0, delivery_charges: 500, cancelled: 1, returned: 0, customers: 2 },
  now: { pending_orders: 4, to_ship: 1, payments_to_verify: 2 },
  by_status: { pending: 2, cancelled: 1 },
  by_method: [{ method: "cod", orders: 2, sales: "5498" }],
  series: [
    { period: "2025-01-10T00:00:00", orders: 2, valid_orders: 2, sales: 5498, collected: 2249 },
    { period: "2025-01-11T00:00:00", orders: 1, valid_orders: 0, sales: 0, collected: 0 },
  ],
  best_sellers: [
    { product_id: null, name: '=HYPERLINK("http://evil")', slug: null, qty: 2, revenue: 3998, orders: 1 },
    { product_id: "5a292a49-c00e-4bec-8d06-e83c18cdc1b0", name: "Belt, brown", slug: "leather-belt", qty: 1, revenue: 1500, orders: 1 },
  ],
};

describe("report CSV", () => {
  const csv = reportToCsv(reportSchema.parse(raw), "Mohsin FutureTech");
  const lines = csv.replace(/^﻿/, "").split("\r\n");

  it("starts with a BOM so Excel reads UTF-8", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Mohsin FutureTech sales report,2025-01-10 to 2025-01-11");
  });

  it("has the summary, the daily table, best sellers and methods", () => {
    expect(lines).toContain("Sales (PKR),5498.00");
    expect(lines).toContain("Day,Date,Orders,Sales (PKR),Payments received (PKR)");
    expect(lines).toContain("\"Fri, 10 Jan\",2025-01-10,2,5498.00,2249.00");
    expect(lines).toContain("Cash on Delivery,2,5498.00");
  });

  it("neutralises spreadsheet formulas and quotes commas", () => {
    expect(lines).toContain(`"'=HYPERLINK(""http://evil"")",2,1,3998.00`);
    expect(lines).toContain(`"Belt, brown",1,1,1500.00`);
  });
});

describe("chart axis", () => {
  it("picks clean ticks", () => {
    expect(niceTicks(14_996)).toEqual([0, 5000, 10000, 15000]);
    expect(niceTicks(980)).toEqual([0, 250, 500, 750, 1000]);
    expect(niceTicks(0)).toEqual([0, 1000]);
  });
});
