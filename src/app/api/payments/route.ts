/**
 * Payments API (Step 4 — manual verification only).
 *
 * POST /api/payments — submit wallet payment evidence
 * (Transaction ID + receipt screenshot) for an order.
 *
 * Validation (server-side, always re-checked — never trust the client):
 *  - order exists, payment method is a wallet method (not COD)
 *  - payment not already Approved / Paid, and not already submitted
 *    (Pending Verification with a Transaction ID on file)
 *  - Transaction ID present and well-formed
 *  - receipt is a JPG / PNG / WebP image, 5 MB or smaller
 *
 * Live mode (Supabase configured): the screenshot is uploaded to the
 * private `payment-receipts` bucket at
 * `<user_id or guest>/<order_id>/receipt-<timestamp>.<ext>` (see
 * supabase/storage.sql) and the `payments` row is updated with the
 * Transaction ID, receipt path and status `pending_verification`.
 *
 * Demo mode (Supabase NOT configured): the file is validated and then
 * discarded — nothing is uploaded anywhere. The response is
 * `{ mode: "demo" }` and the browser saves the submission (Transaction ID
 * + file name only) in localStorage. Never presented as a real upload.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/data/store";
import { STORAGE_BUCKETS } from "@/lib/constants";
import {
  receiptExtension,
  validateReceiptFile,
  validateTransactionId,
} from "@/lib/payments";
import type { PaymentStatus } from "@/lib/types";

function digitsOnly(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("92")) return `0${digits.slice(2)}`;
  return digits;
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Invalid payment submission. Please try again.");
  }

  const orderNumber = String(form.get("orderNumber") ?? "").trim().toUpperCase();
  const transactionId = String(form.get("transactionId") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const file = form.get("receipt");

  if (!orderNumber) return badRequest("Order number is required.");
  if (!orderNumber.startsWith("MF-")) {
    return badRequest("Enter a valid order number, e.g. MF-20261124-00001.");
  }

  const txnError = validateTransactionId(transactionId);
  if (txnError) return badRequest(txnError);

  if (note.length > 500) {
    return badRequest("Your note must be 500 characters or fewer.");
  }

  if (!(file instanceof File)) {
    return badRequest("Please upload a screenshot of your payment receipt.");
  }
  const fileError = validateReceiptFile(file);
  if (fileError) return badRequest(fileError);

  // Demo mode — validate only; the file is discarded, nothing is uploaded.
  // The browser saves Transaction ID + file name locally. The payment
  // method is supplied by the client (the /pay page hides the form for
  // COD orders); live mode re-checks it against the database below.
  const demoMethod = String(form.get("paymentMethod") ?? "").trim();
  if (demoMethod === "cod") {
    return badRequest(
      "This is a Cash on Delivery order — no payment evidence is needed.",
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      mode: "demo",
      orderNumber,
      transactionId,
      receiptFileName: file.name,
      paymentStatus: "pending_verification" satisfies PaymentStatus,
      message:
        "Demo mode — your payment evidence is saved in this browser only. The screenshot file itself is not uploaded anywhere yet.",
    });
  }

  // Live mode — resolve the order and authorise the submitter.
  const admin = getSupabaseAdmin();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, order_number, user_id, delivery_phone, payment_method, total_amount")
    .eq("order_number", orderNumber)
    .single();
  if (orderError || !order) {
    return badRequest("Order not found.", 404);
  }
  const orderRow = order as unknown as {
    id: string;
    order_number: string;
    user_id: string | null;
    delivery_phone: string;
    payment_method: string;
    total_amount: number;
  };

  if (orderRow.payment_method === "cod") {
    return badRequest(
      "This is a Cash on Delivery order — no payment evidence is needed.",
    );
  }
  if (!["easypaisa", "jazzcash", "nayapay"].includes(orderRow.payment_method)) {
    return badRequest("This order does not use a wallet payment (EasyPaisa, JazzCash or NayaPay).");
  }

  // Authorisation: the signed-in owner, or the delivery phone.
  let allowed = false;
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
    if (userId && orderRow.user_id && userId === orderRow.user_id) allowed = true;
  } catch {
    userId = null;
  }
  if (!allowed && phone) {
    allowed = digitsOnly(phone) === digitsOnly(orderRow.delivery_phone);
  }
  if (!allowed) {
    return badRequest(
      "We could not verify this order. Please enter the phone number you used at checkout.",
      403,
    );
  }

  // Current payment row (created at checkout).
  const { data: paymentRows } = await admin
    .from("payments")
    .select("id, status, transaction_id")
    .eq("order_id", orderRow.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const payment = (paymentRows?.[0] ?? null) as {
    id: string;
    status: PaymentStatus;
    transaction_id: string | null;
  } | null;

  if (payment) {
    if (payment.status === "approved" || payment.status === "paid") {
      return badRequest("This payment has already been approved.", 409);
    }
    if (
      payment.status === "pending_verification" &&
      payment.transaction_id &&
      payment.transaction_id.trim() !== ""
    ) {
      return badRequest(
        "Payment evidence for this order is already submitted and Pending Verification.",
        409,
      );
    }
  }

  // Upload the receipt to the private bucket (service-role bypasses RLS,
  // but the path convention from storage.sql is still followed).
  const ext = receiptExtension(file.type);
  const folder = userId ?? "guest";
  const storagePath = `${folder}/${orderRow.id}/receipt-${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKETS.paymentReceipts)
    .upload(storagePath, Buffer.from(bytes), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: "Could not upload your receipt. Please try again." },
      { status: 500 },
    );
  }

  const update = {
    payment_method: orderRow.payment_method,
    transaction_id: transactionId,
    amount: orderRow.total_amount,
    receipt_url: storagePath,
    status: "pending_verification" as PaymentStatus,
    review_note: note || null,
  };

  if (payment) {
    const { error } = await admin
      .from("payments")
      .update(update)
      .eq("id", payment.id);
    if (error) {
      return NextResponse.json(
        { error: "Could not save your payment evidence. Please try again." },
        { status: 500 },
      );
    }
  } else {
    const { error } = await admin.from("payments").insert({
      order_id: orderRow.id,
      ...update,
    });
    if (error) {
      return NextResponse.json(
        { error: "Could not save your payment evidence. Please try again." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    mode: "live",
    orderNumber: orderRow.order_number,
    transactionId,
    receiptFileName: file.name,
    receiptPath: storagePath,
    paymentStatus: "pending_verification" satisfies PaymentStatus,
    message:
      "Payment evidence submitted. It is now Pending Verification — the store will review it.",
  });
}
