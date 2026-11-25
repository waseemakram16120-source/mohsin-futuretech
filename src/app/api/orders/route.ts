/**
 * Orders API (Step 3).
 *
 * POST /api/orders — creates an order from a validated cart. Prices and
 * stock are ALWAYS re-checked server-side against the catalogue; the
 * client-sent totals are ignored. When Supabase is configured the order
 * is written to `orders` / `order_items` / `payments` via the service-role
 * client (trusted server code — RLS blocks guest inserts, so the anon
 * client cannot create guest orders). When Supabase is NOT configured,
 * the order is returned as mode "demo" and the browser saves it to
 * localStorage — clearly marked demo, never faked as a database write.
 *
 * GET /api/orders?number=MF-...&phone=... — order lookup for tracking
 * and the account order detail page. A logged-in owner may look an order
 * up by number alone; guests must also match the delivery phone.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/data/store";
import {
  getServerCatalogue,
  validateCouponServer,
} from "@/lib/server-catalog";
import { isValidPakistaniPhone } from "@/lib/cart";
import {
  DELIVERY_CHARGES_FLAT,
  FREE_DELIVERY_THRESHOLD,
} from "@/lib/constants";
import type { PaymentMethod } from "@/lib/types";

function digitsOnly(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  // 92 3XXXXXXXXX -> 03XXXXXXXXX so both spellings match.
  if (digits.length === 12 && digits.startsWith("92")) return `0${digits.slice(2)}`;
  return digits;
}

function generateOrderNumber(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  return `MF-${date}-${String(Math.floor(10000 + Math.random() * 90000))}`;
}

interface OrderItemInput {
  variantId?: unknown;
  quantity?: unknown;
}

interface OrderPayload {
  items?: unknown;
  customer?: {
    name?: unknown;
    phone?: unknown;
    address?: unknown;
    city?: unknown;
    province?: unknown;
    postalCode?: unknown;
    notes?: unknown;
  };
  paymentMethod?: unknown;
  couponCode?: unknown;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let payload: OrderPayload;
  try {
    payload = (await request.json()) as OrderPayload;
  } catch {
    return badRequest("Invalid order data.");
  }

  const paymentMethod = payload.paymentMethod as PaymentMethod | undefined;
  if (!paymentMethod || !["cod", "easypaisa", "jazzcash", "nayapay"].includes(paymentMethod)) {
    return badRequest("Please select a payment method.");
  }

  const customer = payload.customer ?? {};
  const name = typeof customer.name === "string" ? customer.name.trim() : "";
  const phone = typeof customer.phone === "string" ? customer.phone.trim() : "";
  const address = typeof customer.address === "string" ? customer.address.trim() : "";
  const city = typeof customer.city === "string" ? customer.city.trim() : "";
  const province = typeof customer.province === "string" ? customer.province.trim() : "";
  const postalCode = typeof customer.postalCode === "string" ? customer.postalCode.trim() : "";
  const notes = typeof customer.notes === "string" ? customer.notes.trim() : "";

  if (name.length < 3) return badRequest("Please enter your full name.");
  if (!isValidPakistaniPhone(phone))
    return badRequest("Please enter a valid Pakistani mobile number (e.g. 0300 1234567).");
  if (address.length < 10)
    return badRequest("Please enter your full delivery address.");
  if (city.length < 2) return badRequest("Please enter your city.");

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return badRequest("Your cart is empty.");
  }

  // Re-price every line from the server catalogue — never trust the client.
  const catalogue = await getServerCatalogue();
  const lines: Array<{
    variantId: string;
    productId: string;
    productSlug: string;
    productName: string;
    image: string;
    sku: string;
    size: string;
    color: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }> = [];
  for (const raw of payload.items as OrderItemInput[]) {
    const variantId = typeof raw.variantId === "string" ? raw.variantId : "";
    const quantity = typeof raw.quantity === "number" ? raw.quantity : 0;
    const variant = catalogue.find((v) => v.variantId === variantId);
    if (!variant) return badRequest("One of the items in your cart is no longer available.");
    if (!Number.isInteger(quantity) || quantity < 1)
      return badRequest("Invalid quantity in your cart.");
    if (quantity > variant.stock) {
      return badRequest(
        `Only ${variant.stock} left in stock for ${variant.productName} (${variant.size} / ${variant.color}).`,
      );
    }
    lines.push({
      variantId: variant.variantId,
      productId: variant.productId,
      productSlug: variant.productSlug,
      productName: variant.productName,
      image: variant.image,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      unitPrice: variant.price,
      quantity,
      lineTotal: variant.price * quantity,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const couponCode =
    typeof payload.couponCode === "string" && payload.couponCode.trim()
      ? payload.couponCode.trim().toUpperCase()
      : null;
  const coupon = couponCode
    ? await validateCouponServer(couponCode, subtotal)
    : { valid: false, discount: 0, message: "" };
  if (couponCode && !coupon.valid) return badRequest(coupon.message);
  const discount = coupon.valid ? coupon.discount : 0;
  const afterDiscount = subtotal - discount;
  const delivery =
    afterDiscount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGES_FLAT;
  const total = afterDiscount + delivery;

  // Logged-in customer (if any) — the order is linked to their account.
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      userId = null;
    }
  }

  if (!isSupabaseConfigured()) {
    // Demo mode — no database write. The browser saves this order locally.
    return NextResponse.json({
      mode: "demo",
      orderNumber: generateOrderNumber(),
      subtotal,
      deliveryCharges: delivery,
      discountAmount: discount,
      couponCode: coupon.valid ? couponCode : null,
      totalAmount: total,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "due" : "pending_verification",
      status: "pending",
      items: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        variantLabel: `${line.size} / ${line.color}`,
        sku: line.sku,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
        image: line.image,
      })),
    });
  }

  // Live mode — write via the service-role client (guest orders allowed).
  const admin = getSupabaseAdmin();
  const orderNumber = generateOrderNumber();
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: userId,
      delivery_name: name,
      delivery_phone: phone,
      delivery_address: address,
      city,
      province: province || null,
      postal_code: postalCode || null,
      subtotal,
      delivery_charges: delivery,
      discount_amount: discount,
      coupon_code: coupon.valid ? couponCode : null,
      total_amount: total,
      payment_method: paymentMethod,
      status: "pending",
      notes: notes || null,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Could not save your order. Please try again." },
      { status: 500 },
    );
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    lines.map((line) => ({
      order_id: (order as { id: string }).id,
      product_id: line.productId,
      variant_id: line.variantId,
      product_name: line.productName,
      variant_label: `${line.size} / ${line.color}`,
      sku: line.sku,
      unit_price: line.unitPrice,
      quantity: line.quantity,
    })),
  );
  if (itemsError) {
    return NextResponse.json(
      { error: "Could not save your order items. Please contact the store." },
      { status: 500 },
    );
  }

  await admin.from("payments").insert({
    order_id: (order as { id: string }).id,
    payment_method: paymentMethod,
    amount: total,
    status: paymentMethod === "cod" ? "due" : "pending_verification",
  });

  return NextResponse.json({
    mode: "live",
    orderNumber: (order as { order_number: string }).order_number,
    orderId: (order as { id: string }).id,
    subtotal,
    deliveryCharges: delivery,
    discountAmount: discount,
    couponCode: coupon.valid ? couponCode : null,
    totalAmount: total,
    paymentMethod,
    paymentStatus: paymentMethod === "cod" ? "due" : "pending_verification",
    status: "pending",
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const number = (searchParams.get("number") ?? "").trim().toUpperCase();
  const phone = (searchParams.get("phone") ?? "").trim();
  if (!number) return badRequest("Order number is required.");

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ mode: "demo", found: false });
  }

  const admin = getSupabaseAdmin();
  const { data: order, error } = await admin
    .from("orders")
    .select("*")
    .eq("order_number", number)
    .single();
  if (error || !order) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  const row = order as unknown as {
    user_id: string | null;
    delivery_phone: string;
  };

  // Authorisation: the owner (signed in) or the delivery phone must match.
  let allowed = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user && row.user_id && data.user.id === row.user_id) allowed = true;
  } catch {
    // Not signed in — fall through to the phone check.
  }
  if (!allowed && phone) {
    allowed = digitsOnly(phone) === digitsOnly(row.delivery_phone);
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "Order not found for this phone number." },
      { status: 404 },
    );
  }

  const orderId = (order as unknown as { id: string }).id;
  const [{ data: items }, { data: payments }] = await Promise.all([
    admin.from("order_items").select("*").eq("order_id", orderId),
    admin.from("payments").select("*").eq("order_id", orderId),
  ]);

  return NextResponse.json({
    mode: "live",
    found: true,
    order: {
      ...(order as Record<string, unknown>),
      items: items ?? [],
      payments: payments ?? [],
    },
  });
}
