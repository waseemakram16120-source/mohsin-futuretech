import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import { ORDER_COOKIE, verifyOrders } from "@/lib/checkout/order-access";
import { orderCookieKey } from "@/lib/checkout/server-keys";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/domain";
import { PAYMENT_METHODS } from "@/config/store";
import { createAdminClient } from "@/lib/supabase/admin";

const money = z.union([z.number(), z.string()]).transform(Number);

const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  created_at: z.string(),
  status: z.enum(ORDER_STATUSES),
  payment_method: z.enum(PAYMENT_METHODS),
  payment_status: z.enum(PAYMENT_STATUSES),
  delivery_name: z.string(),
  delivery_phone: z.string(),
  delivery_address: z.string(),
  city: z.string(),
  province: z.string().nullable(),
  postal_code: z.string().nullable(),
  customer_email: z.string().nullable(),
  notes: z.string().nullable(),
  subtotal: money,
  discount_amount: money,
  delivery_charge: money,
  total_amount: money,
  coupon_code: z.string().nullable(),
  order_items: z.array(
    z.object({
      id: z.string().uuid(),
      product_name: z.string(),
      product_slug: z.string().nullable(),
      sku: z.string(),
      size: z.string(),
      color: z.string(),
      image_url: z.string().nullable(),
      unit_price: money,
      quantity: z.number().int(),
      line_total: money,
    }),
  ),
});
export type OrderView = z.infer<typeof orderSchema>;

/** Order numbers this browser placed (verified signed cookie). */
export async function ordersPlacedHere(): Promise<string[]> {
  const jar = await cookies();
  return verifyOrders(orderCookieKey(), jar.get(ORDER_COOKIE)?.value);
}

/**
 * The order, if this browser placed it. Read with the service role because
 * guests have no database session; access is gated by the signed cookie.
 */
export async function getOrderPlacedHere(orderNumber: string): Promise<OrderView | null> {
  const number = orderNumber.toUpperCase();
  if (!(await ordersPlacedHere()).includes(number)) return null;
  const { data, error } = await createAdminClient()
    .from("orders")
    .select(
      "id, order_number, created_at, status, payment_method, payment_status, delivery_name, delivery_phone, delivery_address, city, province, postal_code, customer_email, notes, subtotal, discount_amount, delivery_charge, total_amount, coupon_code, " +
        "order_items(id, product_name, product_slug, sku, size, color, image_url, unit_price, quantity, line_total)",
    )
    .eq("order_number", number)
    .maybeSingle();
  if (error) throw new Error("Could not load order", { cause: error });
  return data ? orderSchema.parse(data) : null;
}
