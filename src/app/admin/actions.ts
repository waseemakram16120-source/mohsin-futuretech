"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/z";
import { adminActionError } from "@/lib/admin/auth";
import { adminErrorMessage } from "@/lib/admin/errors";
import { ORDER_STATUSES } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

export interface AdminResult {
  ok: boolean;
  message: string;
}

const statusSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional().default(""),
});

/** Proposal §7 workflow; the database enforces the allowed transitions. */
export async function changeOrderStatus(input: z.input<typeof statusSchema>): Promise<AdminResult> {
  const denied = await adminActionError();
  if (denied) return { ok: false, message: denied };
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { error } = await (await createClient()).rpc("update_order_status", {
    p_order_id: parsed.data.orderId,
    p_to: parsed.data.to,
    p_note: parsed.data.note || null,
  });
  if (error) return { ok: false, message: adminErrorMessage(error.message) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Order status updated." };
}

const reviewSchema = z.object({
  paymentId: z.string().uuid(),
  action: z.enum(["approve", "reject", "mark_paid"]),
  note: z.string().trim().max(500).optional().default(""),
});

/** Proposal §6: approve / reject (reason required) / mark COD paid. */
export async function reviewPayment(input: z.input<typeof reviewSchema>): Promise<AdminResult> {
  const denied = await adminActionError();
  if (denied) return { ok: false, message: denied };
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  if (parsed.data.action === "reject" && parsed.data.note.length < 3) {
    return { ok: false, message: adminErrorMessage("review_note_required") };
  }
  const { error } = await (await createClient()).rpc("review_payment", {
    p_payment_id: parsed.data.paymentId,
    p_action: parsed.data.action,
    p_note: parsed.data.note || null,
  });
  if (error) return { ok: false, message: adminErrorMessage(error.message) };
  revalidatePath("/admin", "layout");
  const done = { approve: "Payment approved.", reject: "Payment rejected — the customer can now resubmit.", mark_paid: "Marked as paid." };
  return { ok: true, message: done[parsed.data.action] };
}
