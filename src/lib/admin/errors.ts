/** Admin-facing text for database error codes (safe to show). */
const MESSAGES: Record<string, string> = {
  forbidden: "You don't have permission to do that.",
  invalid_transition: "That status change isn't allowed from the order's current status.",
  payment_not_verified: "Approve the payment first — a JazzCash/Easypaisa order can be confirmed only after its payment is verified.",
  order_not_found: "Order not found.",
  payment_not_found: "Payment not found.",
  payment_superseded: "This payment record has been replaced by a newer submission. Refresh the page.",
  invalid_payment_action: "That action isn't possible for this payment's current status.",
  review_note_required: "Write a reason (at least 3 characters) so the customer knows what to fix.",
  order_closed: "This order is cancelled or returned.",
  note_too_long: "The note is too long.",
  invalid_quantity: "Enter a whole number that is not zero.",
  stock_negative: "Stock can't go below zero.",
  variant_not_found: "Variant not found.",
};

export function adminErrorMessage(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || "Something went wrong. Please try again.";
}
