import type { NextRequest } from "next/server";
import { isAdminUser } from "@/lib/admin/auth";
import { reportToCsv } from "@/lib/admin/report-data";
import { resolveRange } from "@/lib/admin/report-range";
import { getReport } from "@/lib/admin/reports";
import { getStoreSettings } from "@/lib/catalog/queries";

/** GET /admin/reports/export?range=…&from=…&to=…&group=… — CSV download (admins only). */
export async function GET(request: NextRequest) {
  if (!(await isAdminUser())) return new Response("Forbidden", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const range = resolveRange({ range: sp.get("range") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, group: sp.get("group") ?? undefined });
  try {
    const [report, settings] = await Promise.all([getReport(range), getStoreSettings()]);
    return new Response(reportToCsv(report, settings.storeName), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sales-report-${range.from}-to-${range.to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/reports/export]", (error as Error).message);
    return new Response("Could not build the report.", { status: 500 });
  }
}
