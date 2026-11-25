import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "./types";

/** Store identity — replace logo / tagline with the real branding in Step 2. */
export const STORE_NAME = "Mohsin FutureTech";
export const STORE_TAGLINE = "Online Fashion & Clothing Store";
export const CURRENCY = "PKR";

/** Format a number as Pakistani Rupees, e.g. 3499 -> "Rs 3,499". */
export function formatPKR(amount: number): string {
  return `Rs ${new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

/** Flat delivery fee until real courier rates are configured. */
export const DELIVERY_CHARGES_FLAT = 200;
/** Orders at or above this subtotal ship free (placeholder rule). */
export const FREE_DELIVERY_THRESHOLD = 5000;

export interface PaymentMethodInfo {
  value: PaymentMethod;
  label: string;
  shortLabel: string;
  description: string;
  /** Shown at checkout — fill in the real account details before launch. */
  instructions: string;
}

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  {
    value: "cod",
    label: "Cash on Delivery",
    shortLabel: "COD",
    description: "Pay in cash when your order arrives at your doorstep.",
    instructions:
      "No advance payment needed. Please keep the exact amount ready on delivery.",
  },
  {
    value: "easypaisa",
    label: "EasyPaisa",
    shortLabel: "EasyPaisa",
    description:
      "Pay via EasyPaisa, then submit your Transaction ID and payment screenshot.",
    instructions:
      "Send payment to the EasyPaisa account shown here, then submit your Transaction ID and screenshot. Account details to be added by the store owner.",
  },
  {
    value: "jazzcash",
    label: "JazzCash",
    shortLabel: "JazzCash",
    description:
      "Pay via JazzCash, then submit your Transaction ID and payment screenshot.",
    instructions:
      "Send payment to the JazzCash account shown here, then submit your Transaction ID and screenshot. Account details to be added by the store owner.",
  },
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending_verification: "Pending Verification",
  approved: "Approved",
  rejected: "Rejected",
  due: "Due on Delivery",
  paid: "Paid",
};

export interface OrderStatusInfo {
  value: OrderStatus;
  label: string;
  description: string;
}

export const ORDER_STATUSES: OrderStatusInfo[] = [
  { value: "pending", label: "Pending", description: "Order submitted, awaiting review." },
  { value: "confirmed", label: "Confirmed", description: "Order accepted by the store." },
  { value: "processing", label: "Processing", description: "Items being prepared / packed." },
  { value: "shipped", label: "Shipped", description: "Order dispatched." },
  { value: "delivered", label: "Delivered", description: "Customer received the order." },
  { value: "cancelled", label: "Cancelled", description: "Order cancelled." },
  { value: "returned", label: "Returned", description: "Order marked returned." },
];

/** Supabase Storage bucket names (see supabase/storage.sql). */
export const STORAGE_BUCKETS = {
  productImages: "product-images",
  paymentReceipts: "payment-receipts",
} as const;

/** Path for a payment receipt: payment-receipts/<user_id>/<order_id>/<file> */
export function receiptStoragePath(
  userId: string,
  orderId: string,
  fileName: string,
): string {
  return `${userId}/${orderId}/${Date.now()}-${fileName}`;
}
