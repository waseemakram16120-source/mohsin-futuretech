import "server-only";

import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "@/lib/domain";
import { ALL_PAYMENT_METHODS, type AnyPaymentMethod } from "@/config/store";
import { createClient } from "@/lib/supabase/server";

export interface OrderSummaryRow {
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: AnyPaymentMethod;
  total: number;
  itemCount: number;
}

/** The signed-in customer's orders, newest first (RLS: own orders only). */
export async function getMyOrders(limit = 50): Promise<OrderSummaryRow[]> {
  const { data, error } = await (await createClient())
    .from("orders")
    .select("order_number, created_at, status, payment_status, payment_method, total_amount, order_items(quantity)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Could not load orders", { cause: error });
  return (data ?? [])
    .filter(
      (o) =>
        (ORDER_STATUSES as readonly string[]).includes(o.status) &&
        (PAYMENT_STATUSES as readonly string[]).includes(o.payment_status) &&
        (ALL_PAYMENT_METHODS as readonly string[]).includes(o.payment_method),
    )
    .map((o) => ({
      orderNumber: o.order_number,
      createdAt: o.created_at,
      status: o.status as OrderStatus,
      paymentStatus: o.payment_status as PaymentStatus,
      paymentMethod: o.payment_method as AnyPaymentMethod,
      total: Number(o.total_amount),
      itemCount: (o.order_items ?? []).reduce((n: number, i: { quantity: number }) => n + i.quantity, 0),
    }));
}
