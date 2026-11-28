/** Report shape (validated) and CSV export. Pure: unit-tested. */
import { z } from "@/lib/z";
import { ALL_PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/config/store";
import { periodLabel } from "./report-range";

const money = z.union([z.number(), z.string()]).transform(Number);
const count = z.union([z.number(), z.string()]).transform(Number);

export const reportSchema = z.object({
  from: z.string(),
  to: z.string(),
  group: z.enum(["day", "month"]),
  summary: z.object({
    orders: count,
    valid_orders: count,
    sales: money,
    collected: money,
    avg_order_value: money,
    items_sold: count,
    discounts: money,
    delivery_charges: money,
    cancelled: count,
    returned: count,
    customers: count,
  }),
  now: z.object({ pending_orders: count, to_ship: count, payments_to_verify: count }),
  by_status: z.record(z.string(), count),
  by_method: z.array(z.object({ method: z.enum(ALL_PAYMENT_METHODS), orders: count, sales: money })),
  series: z.array(z.object({ period: z.string(), orders: count, valid_orders: count, sales: money, collected: money })),
  best_sellers: z.array(
    z.object({ product_id: z.string().nullable(), name: z.string(), slug: z.string().nullable(), qty: count, revenue: money, orders: count }),
  ),
});
export type Report = z.infer<typeof reportSchema>;

function cell(v: string | number): string {
  const s = String(v);
  // Quote when needed; neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const row = (cells: Array<string | number>) => cells.map(cell).join(",");

/** One CSV file with the summary, the period table, best sellers and payment methods. */
export function reportToCsv(r: Report, storeName: string): string {
  const s = r.summary;
  const lines: string[] = [
    row([`${storeName} sales report`, `${r.from} to ${r.to}`]),
    "",
    row(["Summary", "Value"]),
    row(["Orders placed", s.orders]),
    row(["Orders counted as sales (not cancelled/returned)", s.valid_orders]),
    row(["Sales (PKR)", s.sales.toFixed(2)]),
    row(["Payments received (PKR)", s.collected.toFixed(2)]),
    row(["Average order value (PKR)", s.avg_order_value.toFixed(2)]),
    row(["Items sold", s.items_sold]),
    row(["Discounts given (PKR)", s.discounts.toFixed(2)]),
    row(["Delivery charges (PKR)", s.delivery_charges.toFixed(2)]),
    row(["Cancelled orders", s.cancelled]),
    row(["Returned orders", s.returned]),
    row(["Customers", s.customers]),
    "",
    row([r.group === "month" ? "Month" : "Day", "Date", "Orders", "Sales (PKR)", "Payments received (PKR)"]),
    ...r.series.map((p) => row([periodLabel(p.period, r.group), p.period.slice(0, 10), p.orders, p.sales.toFixed(2), p.collected.toFixed(2)])),
    "",
    row(["Best-selling product", "Units sold", "Orders", "Revenue (PKR)"]),
    ...r.best_sellers.map((b) => row([b.name, b.qty, b.orders, b.revenue.toFixed(2)])),
    "",
    row(["Payment method", "Orders", "Sales (PKR)"]),
    ...r.by_method.map((m) => row([PAYMENT_METHOD_LABELS[m.method], m.orders, m.sales.toFixed(2)])),
  ];
  // BOM so Excel opens UTF-8 (Rs, names) correctly.
  return `﻿${lines.join("\r\n")}\r\n`;
}
