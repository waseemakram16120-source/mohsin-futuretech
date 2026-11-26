/**
 * Checkout validation — ONE schema used by the browser (inline errors) and
 * by POST /api/orders (authoritative). The database re-checks again.
 */
import { z } from "zod";
import { PAYMENT_METHODS } from "@/config/store";
import { normalizePkPhone } from "./phone";

export const PROVINCES = [
  "Sindh",
  "Punjab",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu and Kashmir",
] as const;

/** Suggestions only — any city can be typed. */
export const CITY_SUGGESTIONS = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta",
  "Hyderabad", "Gujranwala", "Sialkot", "Sargodha", "Bahawalpur", "Sukkur", "Abbottabad", "Mardan",
];

const text = (min: number, max: number, label: string) =>
  z
    .string({ error: `Please enter your ${label}.` })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(min, min <= 1 ? `Please enter your ${label}.` : `Please enter your full ${label}.`)
        .max(max, `Your ${label} is too long (max ${max} characters).`),
    );

export const customerSchema = z.object({
  name: text(3, 120, "name").refine((s) => /\p{L}/u.test(s), "Please enter your full name."),
  phone: z
    .string({ error: "Please enter your mobile number." })
    .transform((s, ctx) => {
      const phone = normalizePkPhone(s);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Enter a valid Pakistani mobile number, e.g. 0300 1234567." });
        return z.NEVER;
      }
      return phone;
    }),
  email: z
    .string()
    .trim()
    .max(200)
    .transform((s) => s.toLowerCase())
    .pipe(z.union([z.literal(""), z.email("Please enter a valid email address or leave it empty.")]))
    .optional()
    .default(""),
  address: text(10, 400, "delivery address"),
  city: text(2, 80, "city"),
  province: z.union([z.enum(PROVINCES), z.literal("")]).optional().default(""),
  postalCode: z
    .string()
    .trim()
    .pipe(z.union([z.literal(""), z.string().regex(/^\d{5}$/, "Postal code must be 5 digits.")]))
    .optional()
    .default(""),
  notes: z.string().trim().max(500, "Notes can be up to 500 characters.").optional().default(""),
});
export type CustomerInput = z.input<typeof customerSchema>;
export type Customer = z.output<typeof customerSchema>;

export const cartItemsSchema = z
  .array(
    z.object({
      variantId: z.string().uuid(),
      quantity: z.number().int().min(1).max(10),
    }),
  )
  .min(1, "Your bag is empty.")
  .max(50);

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(30)
  .regex(/^[A-Z0-9]*$/, "Coupon codes contain only letters and numbers.");

export const placeOrderSchema = z.object({
  customer: customerSchema,
  items: cartItemsSchema,
  paymentMethod: z.enum(PAYMENT_METHODS, { error: "Please choose a payment method." }),
  couponCode: couponCodeSchema.optional().default(""),
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

/** Field → first error message, for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.filter((p) => p !== "customer").join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
