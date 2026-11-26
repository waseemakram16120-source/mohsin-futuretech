/**
 * PATCH /api/admin/payments/[id] — admin payment review (PDF §6).
 *
 * action "approve": payment → Approved/Verified; if the order is still
 * Pending it moves to Confirmed so it can proceed.
 * action "reject": payment → Rejected with a required reason; the order
 * stays on hold (NOT auto-cancelled) and the customer may resubmit.
 * action "mark-paid": COD payment Due → Paid after delivery/collection.
 */
import { NextResponse } from "next/server";
import { requireAdminAsync } from "@/lib/admin-auth";
import type { PaymentStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminAsync();
  if (auth.mode === "demo") return NextResponse.json({ mode: "demo", ok: true });
  const { id } = await params;
  let body: { action?: unknown; note?: unknown };
  try {
    body = (await request.json()) as { action?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const action = body.action as string | undefined;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!["approve", "reject", "mark-paid"].includes(action ?? "")) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  if (action === "reject" && !note) {
    return NextResponse.json(
      { error: "Please add a reason for rejecting this payment." },
      { status: 400 },
    );
  }

  const status: PaymentStatus =
    action === "approve" ? "approved" : action === "reject" ? "rejected" : "paid";

  const { data: payment, error: fetchError } = await auth.admin
    .from("payments")
    .select("id, order_id, status")
    .eq("id", id)
    .single();
  if (fetchError || !payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  const row = payment as { id: string; order_id: string; status: PaymentStatus };
  if (row.status === "approved" || row.status === "paid") {
    return NextResponse.json(
      { error: "This payment has already been reviewed." },
      { status: 409 },
    );
  }

  const { error } = await auth.admin
    .from("payments")
    .update({
      status,
      review_note: note || null,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Could not update the payment." },
      { status: 500 },
    );
  }

  // Approved payment lets a pending order proceed (PDF §6).
  if (action === "approve") {
    const { data: order } = await auth.admin
      .from("orders")
      .select("id, status")
      .eq("id", row.order_id)
      .single();
    const orderRow = order as { id: string; status: string } | null;
    if (orderRow?.status === "pending") {
      await auth.admin
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", row.order_id);
    }
  }

  return NextResponse.json({ mode: "live", ok: true, status });
}
