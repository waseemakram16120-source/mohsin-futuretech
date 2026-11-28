/**
 * Live chat validation — shared by the chat widget and the API (pure,
 * unit-tested). The database re-checks lengths and formats.
 */
import { z } from "@/lib/z";
import { normalizePkPhone } from "@/lib/checkout/phone";

export const MAX_MESSAGE = 1000;

export const messageSchema = z
  .string({ error: "Type a message." })
  .transform((s) => s.replace(/\r\n/g, "\n").trim())
  .pipe(z.string().min(1, "Type a message.").max(MAX_MESSAGE, `Keep messages under ${MAX_MESSAGE} characters.`));

export const startChatSchema = z.object({
  name: z
    .string({ error: "Enter your name." })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(2, "Enter your name.").max(80, "Name is too long.")),
  phone: z
    .string()
    .optional()
    .default("")
    .transform((s, ctx) => {
      if (!s.trim()) return null;
      const p = normalizePkPhone(s);
      if (!p) {
        ctx.addIssue({ code: "custom", message: "Enter a valid Pakistani mobile number, e.g. 0300 1234567." });
        return z.NEVER;
      }
      return p;
    }),
  orderNumber: z
    .string()
    .optional()
    .default("")
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.union([z.literal(""), z.string().regex(/^MF-\d{6}-\d{5,}$/, "Order numbers look like MF-261127-00031.")]))
    .transform((s) => s || null),
  message: messageSchema,
});
export type StartChat = z.infer<typeof startChatSchema>;

export interface ChatMessage {
  id: number;
  sender: "customer" | "admin";
  body: string;
  created_at: string;
}
