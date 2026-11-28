import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getProfile, getSessionUser, type SessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/** True only for a signed-in user whose profile role is 'admin' (checked in the database). */
export const isAdminUser = cache(async (): Promise<boolean> => {
  const user = await getSessionUser();
  if (!user) return false;
  const { data, error } = await (await createClient()).rpc("is_admin");
  return !error && data === true;
});

/**
 * For admin pages: signed-out visitors go to sign in (and come back),
 * signed-in non-admins see "access denied". This is the UI gate; every
 * database function also runs require_admin() and RLS limits every read.
 */
export async function requireAdmin(path: string): Promise<SessionUser & { name: string }> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!(await isAdminUser())) redirect("/access-denied");
  const profile = await getProfile();
  return { ...user, name: profile?.fullName || user.email };
}

/** For Server Actions: null when the caller may act as admin, else a message. */
export async function adminActionError(): Promise<string | null> {
  if (!(await getSessionUser())) return "Your session has ended. Please sign in again.";
  if (!(await isAdminUser())) return "You don't have permission to do that.";
  return null;
}
