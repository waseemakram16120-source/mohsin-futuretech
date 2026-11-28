import "server-only";

import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHAT_COOKIE, CHAT_COOKIE_MAX_AGE, hashToken, newGuestToken, packCookie, tokenMatches, unpackCookie } from "./token";

export interface Caller {
  userId: string | null;
  conversationId: string | null;
}

/**
 * Which conversation the caller may use: a signed-in customer's latest one,
 * or the guest conversation named by the httpOnly cookie (token checked
 * against its stored hash). Nobody else's conversation is ever returned.
 */
export async function resolveCaller(): Promise<Caller> {
  const user = await getSessionUser();
  const admin = createAdminClient();
  if (user) {
    const { data } = await admin
      .from("chat_conversations")
      .select("id")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { userId: user.id, conversationId: data?.id ?? null };
  }
  const cookie = unpackCookie((await cookies()).get(CHAT_COOKIE)?.value);
  if (!cookie) return { userId: null, conversationId: null };
  const { data } = await admin
    .from("chat_conversations")
    .select("id, guest_token_hash")
    .eq("id", cookie.conversationId)
    .maybeSingle();
  if (!data || !tokenMatches(cookie.token, data.guest_token_hash)) return { userId: null, conversationId: null };
  return { userId: null, conversationId: data.id };
}

/** A new guest token; the hash goes to the database, the cookie to the browser. */
export function newGuestCredentials() {
  const token = newGuestToken();
  return { token, hash: hashToken(token) };
}

export async function setGuestCookie(conversationId: string, token: string, secure: boolean) {
  (await cookies()).set(CHAT_COOKIE, packCookie(conversationId, token), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: CHAT_COOKIE_MAX_AGE,
  });
}
