/**
 * Account form validation — shared by the browser (inline errors) and the
 * Server Actions (authoritative). The database re-checks profiles/addresses.
 */
import { z } from "@/lib/z";
import { PROVINCES } from "@/lib/checkout/schema";
import { normalizePkPhone } from "@/lib/checkout/phone";

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address.")
  .max(200, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

export const PASSWORD_MIN = 8;
const newPassword = z
  .string({ error: "Choose a password." })
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .max(72, "Use at most 72 characters.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use at least one letter and one number.");

const name = z
  .string({ error: "Enter your name." })
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(3, "Enter your full name.").max(120, "Name is too long."))
  .refine((s) => /\p{L}/u.test(s), "Enter your full name.");

const pkPhone = (required: boolean) =>
  z.string().transform((s, ctx) => {
    if (!s.trim() && !required) return null;
    const phone = normalizePkPhone(s);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Pakistani mobile number, e.g. 0300 1234567." });
      return z.NEVER;
    }
    return phone;
  });

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(200),
});

export const signupSchema = z
  .object({ name, email, password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });

export const profileSchema = z.object({ name, phone: pkPhone(false) });

export const addressSchema = z.object({
  label: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Give this address a label, e.g. Home.").max(40, "Label is too long.")),
  name,
  phone: pkPhone(true),
  line1: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(10, "Enter the full address (house, street, area).").max(200, "Address is too long.")),
  line2: z.string().trim().max(200, "Too long.").optional().default(""),
  city: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, "Enter your city.").max(80, "City is too long.")),
  province: z.union([z.enum(PROVINCES), z.literal("")]).optional().default(""),
  postalCode: z
    .string()
    .trim()
    .pipe(z.union([z.literal(""), z.string().regex(/^\d{5}$/, "Postal code must be 5 digits.")]))
    .optional()
    .default(""),
  isDefault: z.boolean().optional().default(false),
});
export type AddressInput = z.output<typeof addressSchema>;

/** First message per field, for inline errors. */
export function issuesByField(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Track an order: order number + the phone used at checkout. */
export const trackSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.string().regex(/^MF-\d{6}-\d{5,}$/, "Enter the order number exactly as shown, e.g. MF-261127-00031.")),
  phone: pkPhone(true),
});
