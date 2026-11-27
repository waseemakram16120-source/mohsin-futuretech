"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword, type FormState } from "@/app/(auth)/actions";
import { Field, FormMessage, TextInput } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { PASSWORD_MIN } from "@/lib/auth/schemas";
import { PasswordInput } from "./PasswordInput";

const initial: FormState = {};

function Submit({ pending, children, busy }: { pending: boolean; children: string; busy: string }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? busy : children}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  const id = useId();
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {state.message ? <FormMessage tone="error" testId="form-message">{state.message}</FormMessage> : null}
      <Field id={`${id}-email`} label="Email" error={e.email}>
        <TextInput id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} error={e.email} required />
      </Field>
      <Field id={`${id}-password`} label="Password" error={e.password}>
        <PasswordInput id={`${id}-password`} name="password" autoComplete="current-password" error={e.password} required />
      </Field>
      <div className="flex justify-end text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4 hover:text-accent-strong">
          Forgot password?
        </Link>
      </div>
      <Submit pending={pending} busy="Signing in…">
        Sign in
      </Submit>
    </form>
  );
}

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  const id = useId();
  const e = state.errors ?? {};
  if (state.ok) return <FormMessage tone="success" testId="form-message">{state.message}</FormMessage>;
  return (
    <form action={action} noValidate className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {state.message ? <FormMessage tone="error" testId="form-message">{state.message}</FormMessage> : null}
      <Field id={`${id}-name`} label="Full name" error={e.name}>
        <TextInput id={`${id}-name`} name="name" autoComplete="name" defaultValue={state.values?.name} error={e.name} required />
      </Field>
      <Field id={`${id}-email`} label="Email" error={e.email}>
        <TextInput id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} error={e.email} required />
      </Field>
      <Field id={`${id}-password`} label="Password" error={e.password} hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`}>
        <PasswordInput id={`${id}-password`} name="password" autoComplete="new-password" error={e.password} hint required />
      </Field>
      <Field id={`${id}-confirm`} label="Confirm password" error={e.confirmPassword}>
        <PasswordInput id={`${id}-confirm`} name="confirmPassword" autoComplete="new-password" error={e.confirmPassword} required />
      </Field>
      <Submit pending={pending} busy="Creating your account…">
        Create account
      </Submit>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  const id = useId();
  const e = state.errors ?? {};
  if (state.ok) return <FormMessage tone="success" testId="form-message">{state.message}</FormMessage>;
  return (
    <form action={action} noValidate className="space-y-5">
      {state.message ? <FormMessage tone="error" testId="form-message">{state.message}</FormMessage> : null}
      <Field id={`${id}-email`} label="Email" error={e.email}>
        <TextInput id={`${id}-email`} name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} error={e.email} required />
      </Field>
      <Submit pending={pending} busy="Sending…">
        Send reset link
      </Submit>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  const id = useId();
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      {state.message ? <FormMessage tone="error" testId="form-message">{state.message}</FormMessage> : null}
      <Field id={`${id}-password`} label="New password" error={e.password} hint={`At least ${PASSWORD_MIN} characters, with a letter and a number.`}>
        <PasswordInput id={`${id}-password`} name="password" autoComplete="new-password" error={e.password} hint required />
      </Field>
      <Field id={`${id}-confirm`} label="Confirm new password" error={e.confirmPassword}>
        <PasswordInput id={`${id}-confirm`} name="confirmPassword" autoComplete="new-password" error={e.confirmPassword} required />
      </Field>
      <Submit pending={pending} busy="Saving…">
        Save new password
      </Submit>
    </form>
  );
}
