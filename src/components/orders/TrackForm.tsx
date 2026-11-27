"use client";

import { useActionState, useId } from "react";
import { trackOrder, type TrackState } from "@/app/(shop)/track/actions";
import { Field, FormMessage, TextInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";

export function TrackForm({ defaultOrderNumber = "" }: { defaultOrderNumber?: string }) {
  const [state, action, pending] = useActionState<TrackState, FormData>(trackOrder, {});
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
          defaultValue={state.values?.orderNumber ?? defaultOrderNumber}
          error={e.orderNumber}
          hint
          className="font-mono uppercase"
        />
      </Field>
      <Field id={`${id}-phone`} label="Mobile number used for the order" error={e.phone}>
        <TextInput id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={state.values?.phone} error={e.phone} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Looking up…" : "Track order"}
      </Button>
    </form>
  );
}
