import "server-only";

import { isGatewayMethod } from "@/config/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { secureReference } from "./crypto";
import { EVIDENCE_ERRORS, MAX_RECEIPT_BYTES, sniffImage, type EvidenceFields } from "./evidence";
import { logPayment } from "./log";
import { walletMode } from "./registry";
import { authorisedOrder } from "./service";

const RECEIPT_BUCKET = "payment-receipts";

export type EvidenceResult =
  | { ok: true; paymentStatus: "pending_verification" }
  | { ok: false; status: number; message: string };

/**
 * Manual wallet payment (proposal §4): store the receipt in the PRIVATE
 * bucket, then record the evidence with submit_payment_evidence(), which
 * moves the payment to "Pending Verification". Only an admin can approve
 * it (review_payment). Amount and order come from our database, never from
 * the request.
 */
export async function submitEvidence(orderNumber: string, fields: EvidenceFields, receipt: File): Promise<EvidenceResult> {
  const order = await authorisedOrder(orderNumber);
  if (!order) return { ok: false, status: 404, message: "Order not found." };
  if (!isGatewayMethod(order.payment_method)) return { ok: false, ...EVIDENCE_ERRORS.cod_no_evidence };
  if (walletMode(order.payment_method) !== "manual") {
    return { ok: false, status: 409, message: "This order is paid online. Please use the Pay button on your order page." };
  }

  if (receipt.size === 0 || receipt.size > MAX_RECEIPT_BYTES) {
    return { ok: false, status: 400, message: "The receipt image must be 5 MB or smaller." };
  }
  const bytes = new Uint8Array(await receipt.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, ...EVIDENCE_ERRORS.invalid_receipt };

  const admin = createAdminClient();
  const path = `${order.id}/receipt-${Date.now()}-${secureReference(10).toLowerCase()}.${kind.ext}`;
  const upload = await admin.storage.from(RECEIPT_BUCKET).upload(path, bytes, { contentType: kind.contentType, upsert: false });
  if (upload.error) {
    logPayment("error", { event: "evidence_upload_failed", orderNumber: order.order_number, reason: upload.error.name });
    return { ok: false, status: 500, message: "We couldn't upload your receipt. Please try again." };
  }

  const { error } = await admin.rpc("submit_payment_evidence", {
    p_order_number: order.order_number,
    p_user_id: order.user_id,
    p_phone: order.delivery_phone,
    p_transaction_id: fields.transactionId,
    p_receipt_path: path,
    p_note: fields.note || null,
  });
  if (error) {
    // Nothing was recorded, so the uploaded file is not kept.
    await admin.storage.from(RECEIPT_BUCKET).remove([path]).catch(() => undefined);
    const known = EVIDENCE_ERRORS[error.message];
    logPayment(known ? "info" : "error", { event: "evidence_refused", orderNumber: order.order_number, reason: known ? error.message : "db_error" });
    return known ? { ok: false, ...known } : { ok: false, status: 500, message: "We couldn't save your payment details. Please try again." };
  }

  logPayment("info", { event: "evidence_submitted", provider: order.payment_method, orderNumber: order.order_number, status: "pending_verification" });
  return { ok: true, paymentStatus: "pending_verification" };
}

export interface EvidenceState {
  status: string;
  transaction_id: string | null;
  submitted_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
}

/** Latest payment record for the order page (no receipt path). */
export async function evidenceState(orderId: string): Promise<EvidenceState | null> {
  const { data, error } = await createAdminClient().rpc("order_payment_evidence", { p_order_id: orderId });
  if (error) throw new Error("Could not load payment record", { cause: error });
  return (data as EvidenceState | null) ?? null;
}
