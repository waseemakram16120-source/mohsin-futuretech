/**
 * Validation for manual wallet payment evidence (proposal §4): Transaction
 * ID, optional note and the receipt image. Pure module — shared by the
 * browser form and the server route, and unit-tested.
 *
 * The receipt type is decided from the file's own bytes (magic numbers),
 * never from the file name or the browser-sent MIME type.
 */
import { z } from "@/lib/z";
import { storeConfig } from "@/config/store";

export const MAX_RECEIPT_BYTES = storeConfig.uploads.maxImageBytes;

export const evidenceFieldsSchema = z.object({
  transactionId: z
    .string()
    .trim()
    .min(1, "Enter the Transaction ID from your payment receipt.")
    .regex(/^[A-Za-z0-9-]{6,40}$/, "Transaction ID should be 6–40 letters or numbers (no spaces)."),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").optional().default(""),
});
export type EvidenceFields = z.infer<typeof evidenceFieldsSchema>;

export type ReceiptKind = { ext: "jpg" | "png" | "webp"; contentType: "image/jpeg" | "image/png" | "image/webp" };

/** Detect JPG / PNG / WebP from the first bytes of the file. */
export function sniffImage(bytes: Uint8Array): ReceiptKind | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", contentType: "image/jpeg" };
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { ext: "png", contentType: "image/png" };
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }
  return null;
}

/** Quick check in the browser before uploading (the server re-checks the bytes). */
export function receiptProblem(file: { size: number; type: string } | null | undefined): string | null {
  if (!file || file.size === 0) return "Attach a screenshot or photo of your payment receipt.";
  if (file.size > MAX_RECEIPT_BYTES) return "The receipt image must be 5 MB or smaller.";
  if (file.type && !(storeConfig.uploads.allowedImageTypes as readonly string[]).includes(file.type)) {
    return "Upload the receipt as a JPG, PNG or WebP image.";
  }
  return null;
}

/** Customer-facing text for submit_payment_evidence error codes. */
export const EVIDENCE_ERRORS: Record<string, { status: number; message: string }> = {
  evidence_already_submitted: {
    status: 409,
    message: "We already have your payment details for this order. Our team is reviewing them.",
  },
  payment_already_approved: { status: 409, message: "This order's payment has already been approved." },
  transaction_id_used: {
    status: 409,
    message: "This Transaction ID has already been submitted. Please check the ID on your receipt.",
  },
  cod_no_evidence: { status: 409, message: "This order is Cash on Delivery — no payment upload is needed." },
  order_closed: { status: 409, message: "This order is closed. Please contact us if you need help." },
  payment_in_progress: {
    status: 409,
    message: "An online payment for this order is still being processed. Please wait before submitting another payment.",
  },
  invalid_transaction_id: { status: 400, message: "Transaction ID should be 6–40 letters or numbers (no spaces)." },
  invalid_receipt: { status: 400, message: "Upload the receipt as a JPG, PNG or WebP image." },
  note_too_long: { status: 400, message: "Keep the note under 500 characters." },
};
