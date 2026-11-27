import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
}

/**
 * The signed-in user, verified with Supabase Auth (getUser checks the token
 * with the Auth server; never trust an unverified cookie). One call per
 * request thanks to React cache().
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const { data, error } = await (await createClient()).auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? "" };
  } catch {
    return null;
  }
});

/** For account pages: the user, or a redirect to /login?next=<path>. */
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export interface Profile {
  fullName: string;
  phone: string | null;
  email: string;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const { data } = await (await createClient())
    .from("profiles")
    .select("full_name, phone, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return { fullName: "", phone: null, email: user.email };
  return { fullName: data.full_name ?? "", phone: data.phone ?? null, email: data.email ?? user.email };
});

export interface SavedAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export const getAddresses = cache(async (): Promise<SavedAddress[]> => {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await (await createClient())
    .from("addresses")
    .select("id, label, full_name, phone, address_line1, address_line2, city, province, postal_code, is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load addresses", { cause: error });
  return (data ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    fullName: a.full_name,
    phone: a.phone,
    line1: a.address_line1,
    line2: a.address_line2,
    city: a.city,
    province: a.province,
    postalCode: a.postal_code,
    isDefault: a.is_default,
  }));
});
