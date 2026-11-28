import { describe, expect, it } from "vitest";
import { messageSchema, startChatSchema } from "@/lib/chat/schemas";
import { hashToken, newGuestToken, packCookie, tokenMatches, unpackCookie } from "@/lib/chat/token";

const conv = "5a292a49-c00e-4bec-8d06-e83c18cdc1b0";

describe("guest chat token", () => {
  it("round-trips the cookie and matches only the right token", () => {
    const token = newGuestToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(unpackCookie(packCookie(conv, token))).toEqual({ conversationId: conv, token });
    expect(tokenMatches(token, hashToken(token))).toBe(true);
    expect(tokenMatches(newGuestToken(), hashToken(token))).toBe(false);
    expect(tokenMatches(token, null)).toBe(false);
    expect(tokenMatches(token, "nothex")).toBe(false);
  });

  it("rejects tampered cookies", () => {
    for (const bad of [undefined, "", "abc", `${conv}`, `${conv}.short`, `not-a-uuid.${newGuestToken()}`, `${conv}.${newGuestToken()}.x`]) {
      expect(unpackCookie(bad)).toBeNull();
    }
  });
});

describe("chat validation", () => {
  it("start form", () => {
    expect(startChatSchema.parse({ name: "  Sana  Malik ", phone: "+92 300 1234567", orderNumber: " mf-261127-00031 ", message: " Hi " })).toEqual({
      name: "Sana Malik",
      phone: "03001234567",
      orderNumber: "MF-261127-00031",
      message: "Hi",
    });
    expect(startChatSchema.parse({ name: "Ali", message: "Hello" })).toMatchObject({ phone: null, orderNumber: null });
    expect(startChatSchema.safeParse({ name: "A", message: "Hello" }).success).toBe(false);
    expect(startChatSchema.safeParse({ name: "Ali", phone: "123", message: "Hello" }).success).toBe(false);
    expect(startChatSchema.safeParse({ name: "Ali", orderNumber: "12", message: "Hello" }).success).toBe(false);
  });

  it("messages: 1–1000 characters after trimming", () => {
    expect(messageSchema.safeParse("   ").success).toBe(false);
    expect(messageSchema.safeParse("x".repeat(1000)).success).toBe(true);
    expect(messageSchema.safeParse("x".repeat(1001)).success).toBe(false);
    expect(messageSchema.parse("line 1\r\nline 2")).toBe("line 1\nline 2");
  });
});
