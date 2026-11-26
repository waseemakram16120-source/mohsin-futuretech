import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  canTransition,
} from "@/lib/domain";

describe("order workflow (proposal §7)", () => {
  it("follows Pending → Confirmed → Processing → Shipped → Delivered", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "processing")).toBe(true);
    expect(canTransition("processing", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  it("allows cancelling before dispatch and returning after", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("processing", "cancelled")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(canTransition("delivered", "returned")).toBe(true);
  });

  it("never moves backwards and treats Cancelled/Returned as final", () => {
    expect(canTransition("delivered", "pending")).toBe(false);
    expect(canTransition("shipped", "processing")).toBe(false);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.returned).toEqual([]);
  });

  it("has a label for every status", () => {
    for (const s of ORDER_STATUSES) expect(ORDER_STATUS_LABELS[s]).toBeTruthy();
    for (const s of PAYMENT_STATUSES) expect(PAYMENT_STATUS_LABELS[s]).toBeTruthy();
    expect(PAYMENT_STATUS_LABELS.pending_verification).toBe("Pending Verification");
    expect(PAYMENT_STATUS_LABELS.due).toBe("COD — Due");
  });
});
