import "server-only";

import { createClient } from "@/lib/supabase/server";
import { reportSchema, type Report } from "./report-data";
import type { ReportRange } from "./report-range";

export async function getReport(range: ReportRange): Promise<Report> {
  const { data, error } = await (await createClient()).rpc("admin_report", { p_from: range.from, p_to: range.to, p_group: range.group });
  if (error) throw new Error("Could not load report", { cause: error });
  return reportSchema.parse(data);
}
