/**
 * TypeScript types mirroring the Supabase schema in supabase/schema.sql.
 * Keep these in sync with the database — Steps 2–6 build on them.
 */

export type UserRole = "customer" | "admin";

export type PaymentMethod = "cod" | "easypaisa" | "jazzcash";

/** DB values; display labels live in src/lib/constants.ts. */
export type PaymentStatus =
  | "pending_verification"
  | "approved"
  | "rejected"
  | "due"
  | "paid";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type DiscountType = "percentage" | "fixed";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  base_price: number;
  compare_at_price: number | null;
  image_url: string | null;
  is_featured: boolean;
  is_new_arrival: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  price_override: number | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Effective selling price of a variant (override wins, else base price). */
export function variantPrice(variant: ProductVariant, product: Product): number {
  return variant.price_override ?? product.base_price;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  province: string | null;
  postal_code: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  delivery_name: string;
  delivery_phone: string;
  delivery_address: string;
  city: string;
  province: string | null;
  postal_code: string | null;
  subtotal: number;
  delivery_charges: number;
  discount_amount: number;
  coupon_code: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  variant_label: string | null;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  transaction_id: string | null;
  amount: number;
  receipt_url: string | null;
  status: PaymentStatus;
  reviewed_by: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

/** Order with its items and payment submissions attached (admin / tracking). */
export interface OrderWithDetails extends Order {
  items: OrderItem[];
  payments: Payment[];
}
