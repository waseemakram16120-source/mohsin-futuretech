"use client";

import type { InitiationAction } from "@/lib/payments/providers/types";

/**
 * Hand the browser to the provider's hosted flow. Only https URLs (or our
 * own origin, for the sandbox test gateway) are followed.
 */
export function performAction(action: InitiationAction) {
  const allowed = (url: string) => {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin || u.protocol === "https:";
  };
  if (action.type === "redirect") {
    if (!allowed(action.url)) throw new Error("Blocked unsafe payment URL");
    window.location.assign(action.url);
    return;
  }
  if (!allowed(action.action)) throw new Error("Blocked unsafe payment URL");
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action.action;
  for (const [name, value] of Object.entries(action.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export async function startPayment(orderNumber: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch("/api/payments/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderNumber }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.action) return { ok: false, message: body.error ?? "We couldn't start the payment. Please try again." };
  performAction(body.action as InitiationAction);
  return { ok: true };
}
