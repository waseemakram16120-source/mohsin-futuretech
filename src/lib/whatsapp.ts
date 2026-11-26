/**
 * wa.me link for a number in international format without "+" (e.g.
 * 923001234567). Returns null when the number is missing or malformed so
 * the UI can hide WhatsApp entry points instead of linking nowhere.
 */
export function whatsappLink(number: string | null | undefined, message?: string): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (!/^92\d{10}$/.test(digits)) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${text}`;
}
