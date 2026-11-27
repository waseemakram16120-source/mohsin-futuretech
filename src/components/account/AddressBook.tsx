"use client";

import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { deleteAddress, saveAddress, setDefaultAddress, type ActionState } from "@/app/account/actions";
import { Field, FormMessage, TextInput, inputClasses } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import type { SavedAddress } from "@/lib/auth/session";
import { formatPkPhone } from "@/lib/checkout/phone";
import { CITY_SUGGESTIONS, PROVINCES } from "@/lib/checkout/schema";

function AddressForm({ address, onDone, onCancel }: { address: SavedAddress | null; onDone: (message: string) => void; onCancel: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAddress, {});
  const id = useId();
  const e = state.errors ?? {};
  useEffect(() => {
    if (state.ok && state.message) onDone(state.message);
  }, [state, onDone]);

  return (
    <form action={action} noValidate className="space-y-5 rounded-card border border-stone bg-surface p-5 sm:p-6" aria-label={address ? "Edit address" : "New address"}>
      <h3 className="font-display text-xl">{address ? "Edit address" : "New address"}</h3>
      {state.message && !state.ok ? <FormMessage tone="error" testId="form-message">{state.message}</FormMessage> : null}
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${id}-label`} label="Label" error={e.label} hint="e.g. Home, Office">
          <TextInput id={`${id}-label`} name="label" defaultValue={address?.label ?? "Home"} error={e.label} hint maxLength={40} />
        </Field>
        <Field id={`${id}-name`} label="Full name" error={e.name}>
          <TextInput id={`${id}-name`} name="name" autoComplete="name" defaultValue={address?.fullName} error={e.name} />
        </Field>
        <Field id={`${id}-phone`} label="Mobile number" error={e.phone}>
          <TextInput id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={address ? formatPkPhone(address.phone) : ""} error={e.phone} />
        </Field>
        <Field id={`${id}-city`} label="City" error={e.city}>
          <TextInput id={`${id}-city`} name="city" autoComplete="address-level2" list={`${id}-cities`} defaultValue={address?.city} error={e.city} />
          <datalist id={`${id}-cities`}>
            {CITY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field id={`${id}-line1`} label="Address" error={e.line1} className="sm:col-span-2" hint="House, street, area">
          <TextInput id={`${id}-line1`} name="line1" autoComplete="address-line1" defaultValue={address?.line1} error={e.line1} hint />
        </Field>
        <Field id={`${id}-line2`} label="Landmark / apartment" optional error={e.line2} className="sm:col-span-2">
          <TextInput id={`${id}-line2`} name="line2" autoComplete="address-line2" defaultValue={address?.line2 ?? ""} error={e.line2} />
        </Field>
        <Field id={`${id}-province`} label="Province" optional error={e.province}>
          <select id={`${id}-province`} name="province" defaultValue={address?.province ?? ""} className={inputClasses(Boolean(e.province))}>
            <option value="">Select…</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-postal`} label="Postal code" optional error={e.postalCode}>
          <TextInput id={`${id}-postal`} name="postalCode" inputMode="numeric" autoComplete="postal-code" defaultValue={address?.postalCode ?? ""} error={e.postalCode} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault ?? false} className="size-4 accent-ink" />
        Use as my default address
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save address"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddressBook({ addresses, max }: { addresses: SavedAddress[]; max: number }) {
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (addressId: string, fn: (id: string) => Promise<ActionState>) => {
    setBusyId(addressId);
    startTransition(async () => {
      const r = await fn(addressId);
      setNotice({ tone: r.ok ? "success" : "error", text: r.message ?? "" });
      setBusyId(null);
    });
  };

  return (
    <div className="space-y-5">
      {notice?.text ? <FormMessage tone={notice.tone} testId="address-notice">{notice.text}</FormMessage> : null}
      {editing ? (
        <AddressForm
          key={editing === "new" ? "new" : editing.id}
          address={editing === "new" ? null : editing}
          onDone={(m) => {
            setEditing(null);
            setNotice({ tone: "success", text: m });
          }}
          onCancel={() => setEditing(null)}
        />
      ) : addresses.length < max ? (
        <Button
          variant="secondary"
          onClick={() => {
            setNotice(null);
            setEditing("new");
          }}
        >
          Add a new address
        </Button>
      ) : (
        <p className="text-sm text-ink-soft">You can save up to {max} addresses.</p>
      )}

      {addresses.length === 0 && !editing ? (
        <EmptyState icon="pin" title="No saved addresses" description="Save an address to check out faster next time." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2" data-testid="address-list">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-card border border-stone bg-surface p-5" data-testid="address-card">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{a.label}</p>
                {a.isDefault ? <Badge tone="dark">Default</Badge> : null}
              </div>
              <address className="mt-2 flex-1 text-sm leading-relaxed not-italic text-ink-soft">
                <span className="text-ink">{a.fullName}</span>
                <br />
                {a.line1}
                {a.line2 ? (
                  <>
                    <br />
                    {a.line2}
                  </>
                ) : null}
                <br />
                {[a.city, a.province, a.postalCode].filter(Boolean).join(", ")}
                <br />
                {formatPkPhone(a.phone)}
              </address>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <button type="button" className="underline underline-offset-4" onClick={() => setEditing(a)} aria-label={`Edit ${a.label} address`}>
                  Edit
                </button>
                {!a.isDefault ? (
                  <button type="button" className="underline underline-offset-4 disabled:opacity-50" disabled={busyId === a.id} onClick={() => run(a.id, setDefaultAddress)}>
                    Make default
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-sale underline underline-offset-4 disabled:opacity-50"
                  disabled={busyId === a.id}
                  aria-label={`Delete ${a.label} address`}
                  onClick={() => {
                    if (window.confirm(`Delete the ${a.label} address?`)) run(a.id, deleteAddress);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
