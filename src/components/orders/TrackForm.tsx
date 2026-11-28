"use client";

import { useActionState, useId, useState } from "react";
import { trackOrder, type TrackState } from "@/app/(shop)/track/actions";
import { Field, FormMessage, TextInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";

/**
 * Controlled inputs: React resets uncontrolled fields after a form action,
 * which could undo what the customer typed while a lookup was finishing.
 */
export function TrackForm({ defaultOrderNumber = "" }: { defaultOrderNumber?: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, {});
  const [orderNumber, setOrderNumber] = useState(defaultOrderNumber);
  const [phone, setPhone] = useState("");
  const id = useId();
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      {state.message ? <FormMessage tone="error" testId="form-message">{state.message}</FormMessage> : null}
      <Field id={`${id}-order`} label="Order number" error={e.orderNumber} hint="Shown on your order confirmation, e.g. MF-261127-00031.">
        <TextInput
          id={`${id}-order`}
          name="orderNumber"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={orderNumber}
          onChange={(ev) => setOrderNumber(ev.target.value)}
          error={e.orderNumber}
          hint
          className="font-mono uppercase"
        />
      </Field>
      <Field id={`${id}-phone`} label="Mobile number used for the order" error={e.phone}>
        <TextInput id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(ev) => setPhone(ev.target.value)} error={e.phone} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Looking up…" : "Track order"}
      </Button>
    </form>
  );
}
