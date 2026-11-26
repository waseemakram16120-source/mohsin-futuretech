/** Client-side admin API helper (Step 5). */
export async function adminJson(
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(path, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : "Request failed.",
    );
  }
  return json;
}

export async function adminGet(path: string) {
  return adminJson(path);
}

export async function adminSend(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
) {
  return adminJson(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
