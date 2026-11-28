"use client";

import { useActionState, useId } from "react";
import { updateProfile, type ActionState } from "@/app/account/actions";
import { Field, FormMessage, TextInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProfile, {});
  const id = useId();
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="max-w-lg space-y-5">
      {state.message ? (
        <FormMessage tone={state.ok ? "success" : "error"} testId="form-message">
          {state.message}
        </FormMessage>
      ) : null}
      <Field id={`${id}-email`} label="Email" hint="Your sign-in email can't be changed here.">
        <TextInput id={`${id}-email`} value={email} readOnly disabled hint className="bg-sand/50" />
      </Field>
      <Field id={`${id}-name`} label="Full name" error={e.name}>
        <TextInput id={`${id}-name`} name="name" autoComplete="name" defaultValue={name} error={e.name} required />
      </Field>
      <Field id={`${id}-phone`} label="Mobile number" optional error={e.phone} hint="Used to pre-fill checkout, e.g. 0300 1234567.">
        <TextInput id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={phone} error={e.phone} hint />
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
