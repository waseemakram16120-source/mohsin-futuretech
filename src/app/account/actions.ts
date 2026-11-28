"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/z";
import { addressSchema, issuesByField, profileSchema } from "@/lib/auth/schemas";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const MAX_ADDRESSES = 10;
const NOT_SIGNED_IN: ActionState = { message: "Your session has ended. Please sign in again." };
const str = (form: FormData, key: string) => {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
};
const idSchema = z.string().uuid();

/** Every action re-checks the user; RLS also limits rows to their own. */
export async function updateProfile(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return NOT_SIGNED_IN;
  const parsed = profileSchema.safeParse({ name: str(form, "name"), phone: str(form, "phone") });
  if (!parsed.success) return { errors: issuesByField(parsed.error) };

  const { error } = await (await createClient())
    .from("profiles")
    .update({ full_name: parsed.data.name, phone: parsed.data.phone })
    .eq("id", user.id);
  if (error) {
    console.error("[account] profile update failed", error.code);
    return { message: "We couldn't save your profile. Please try again." };
  }
  revalidatePath("/account", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function saveAddress(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return NOT_SIGNED_IN;
  const rawId = str(form, "id");
  const id = rawId ? idSchema.safeParse(rawId) : null;
  if (id && !id.success) return { message: "Invalid address." };
  const parsed = addressSchema.safeParse({
    label: str(form, "label") || "Home",
    name: str(form, "name"),
    phone: str(form, "phone"),
    line1: str(form, "line1"),
    line2: str(form, "line2"),
    city: str(form, "city"),
    province: str(form, "province"),
    postalCode: str(form, "postalCode"),
    isDefault: form.get("isDefault") === "on",
  });
  if (!parsed.success) return { errors: issuesByField(parsed.error) };
  const a = parsed.data;

  const supabase = await createClient();
  const { data: existing, error: listError } = await supabase.from("addresses").select("id, is_default").eq("user_id", user.id);
  if (listError) return { message: "We couldn't save the address. Please try again." };
  if (!id && existing.length >= MAX_ADDRESSES) return { message: `You can save up to ${MAX_ADDRESSES} addresses.` };
  if (id && !existing.some((e) => e.id === id.data)) return { message: "Address not found." };

  // The first address is always the default.
  const makeDefault = a.isDefault || existing.length === 0 || (id !== null && existing.find((e) => e.id === id.data)?.is_default === true);
  if (makeDefault) {
    // One default per user (unique index): clear the old one first.
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  }
  const row = {
    label: a.label,
    full_name: a.name,
    phone: a.phone!,
    address_line1: a.line1,
    address_line2: a.line2 || null,
    city: a.city,
    province: a.province || null,
    postal_code: a.postalCode || null,
    is_default: makeDefault,
  };
  const { error } = id
    ? await supabase.from("addresses").update(row).eq("id", id.data).eq("user_id", user.id)
    : await supabase.from("addresses").insert({ ...row, user_id: user.id });
  if (error) {
    console.error("[account] address save failed", error.code);
    return { message: "We couldn't save the address. Please check the details and try again." };
  }
  revalidatePath("/account", "layout");
  revalidatePath("/checkout");
  return { ok: true, message: id ? "Address updated." : "Address added." };
}

export async function deleteAddress(addressId: string): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return NOT_SIGNED_IN;
  const id = idSchema.safeParse(addressId);
  if (!id.success) return { message: "Invalid address." };
  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id)
    .select("is_default")
    .maybeSingle();
  if (error || !removed) return { message: "We couldn't delete that address." };
  if (removed.is_default) {
    // Promote the oldest remaining address.
    const { data: next } = await supabase.from("addresses").select("id").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
    if (next) await supabase.from("addresses").update({ is_default: true }).eq("id", next.id);
  }
  revalidatePath("/account", "layout");
  revalidatePath("/checkout");
  return { ok: true, message: "Address deleted." };
}

export async function setDefaultAddress(addressId: string): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return NOT_SIGNED_IN;
  const id = idSchema.safeParse(addressId);
  if (!id.success) return { message: "Invalid address." };
  const supabase = await createClient();
  const { data: target } = await supabase.from("addresses").select("id").eq("id", id.data).eq("user_id", user.id).maybeSingle();
  if (!target) return { message: "Address not found." };
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id.data);
  if (error) return { message: "We couldn't update the default address." };
  revalidatePath("/account", "layout");
  revalidatePath("/checkout");
  return { ok: true, message: "Default address updated." };
}
