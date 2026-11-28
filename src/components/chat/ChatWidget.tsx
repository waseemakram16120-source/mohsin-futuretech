"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MAX_MESSAGE, startChatSchema, type ChatMessage } from "@/lib/chat/schemas";
import { cn } from "@/lib/cn";

/** Pages without the chat: checkout (covers fields), admin (has its own inbox). */
const HIDDEN_ON = ["/checkout", "/admin", "/payments/"];
const OPEN_POLL_MS = 4000;
const CLOSED_POLL_MS = 30000;
const ACTIVE_KEY = "mft.chat.active";
const SEEN_KEY = "mft.chat.seen";

interface ChatState {
  conversation: { id: string; status: "open" | "closed"; customer_name: string; order_number: string | null } | null;
  messages: ChatMessage[];
  me: { signedIn: boolean; name: string; phone: string | null };
}

const store = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // storage blocked: the chat still works for this visit
    }
  },
};

const timeFmt = new Intl.DateTimeFormat("en-PK", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });
const dayFmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", timeZone: "Asia/Karachi" });

/**
 * Live chat with the store. Messages are fetched from our API (which checks
 * the signed-in account or the guest's httpOnly cookie) every few seconds
 * while the panel is open, and every 30 s for the unread badge.
 */
export function ChatWidget({ storeName, hours, whatsappHref }: { storeName: string; hours: string; whatsappHref: string | null }) {
  const pathname = usePathname();
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ChatState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newChat, setNewChat] = useState(false);
  const [unread, setUnread] = useState(0);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const firstFieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const lastId = state?.messages.at(-1)?.id ?? 0;

  const merge = useCallback((incoming: ChatState, replace: boolean) => {
    setState((prev) => {
      if (replace || !prev || prev.conversation?.id !== incoming.conversation?.id) return incoming;
      const known = new Set(prev.messages.map((m) => m.id));
      return { ...incoming, messages: [...prev.messages, ...incoming.messages.filter((m) => !known.has(m.id))] };
    });
  }, []);

  const fetchChat = useCallback(
    async (after: number, replace = false) => {
      const res = await fetch(`/api/chat?after=${after}`, { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      const data = (await res.json()) as ChatState;
      merge(data, replace);
      return data;
    },
    [merge],
  );

  const markSeen = (messages: ChatMessage[]) => {
    const lastAdmin = [...messages].reverse().find((m) => m.sender === "admin");
    if (lastAdmin) store.set(SEEN_KEY, String(lastAdmin.id));
    setUnread(0);
  };

  const openPanel = async () => {
    setOpen(true);
    setLoadError(null);
    try {
      const data = await fetchChat(0, true);
      markSeen(data.messages);
    } catch {
      setLoadError("We couldn't load the chat. Please try again.");
    }
  };

  const closePanel = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  // Polling: fast while open, slow (badge only) while closed for returning chatters.
  useEffect(() => {
    if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return;
    if (!open && store.get(ACTIVE_KEY) !== "1") return;
    const id = window.setTimeout(
      async () => {
        try {
          const data = await fetchChat(open ? lastId : 0, !open);
          if (open) markSeen(data.messages.length ? data.messages : (state?.messages ?? []));
          else {
            const seen = Number(store.get(SEEN_KEY) ?? 0);
            setUnread(data.messages.filter((m) => m.sender === "admin" && m.id > seen).length);
          }
        } catch {
          // keep the last state; next poll retries
        }
      },
      open ? OPEN_POLL_MS : state ? CLOSED_POLL_MS : 1500,
    );
    return () => window.clearTimeout(id);
  }, [open, lastId, pathname, fetchChat, state]);

  // Keep the newest message in view.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, lastId]);

  // Esc closes; focus the first field when the panel opens.
  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, state?.conversation?.id, newChat]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const showStart = !state?.conversation || newChat;
  const closed = state?.conversation?.status === "closed";

  return (
    <>
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          onClick={openPanel}
          className={cn(
            "fixed right-4 bottom-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-ink text-surface shadow-lift transition-[bottom,scale] duration-200 hover:scale-105 sm:right-6 sm:bottom-6",
            "in-data-[sticky-bar=true]:bottom-24 sm:in-data-[sticky-bar=true]:bottom-24 lg:in-data-[sticky-bar=true]:bottom-6",
          )}
          aria-label={unread ? `Chat with us — ${unread} new ${unread === 1 ? "reply" : "replies"}` : "Chat with us"}
          data-testid="chat-launcher"
        >
          <Icon name="chat" className="size-6" />
          {unread ? (
            <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-sale px-1 text-xs font-semibold leading-5 text-surface" aria-hidden="true" data-testid="chat-unread">
              {unread}
            </span>
          ) : null}
        </button>
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${uid}-title`}
          className="fixed inset-x-2 bottom-2 z-50 flex max-h-[min(40rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-card border border-stone bg-surface shadow-lift sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[24rem]"
          data-testid="chat-panel"
        >
          <header className="flex items-start justify-between gap-3 bg-ink px-4 py-3 text-surface">
            <div>
              <h2 id={`${uid}-title`} className="font-semibold">
                Chat with {storeName}
              </h2>
              <p className="text-xs text-surface/75">We usually reply {hours}.</p>
            </div>
            <button type="button" onClick={closePanel} className="-mr-1 rounded-xs p-1.5 hover:bg-surface/10" aria-label="Close chat">
              <Icon name="close" className="size-5" />
            </button>
          </header>

          {loadError ? (
            <div className="space-y-3 p-4 text-sm">
              <p role="alert" className="text-sale">
                {loadError}
              </p>
              <Button size="sm" onClick={openPanel}>
                Try again
              </Button>
            </div>
          ) : !state ? (
            <p className="p-4 text-sm text-muted" role="status">
              Loading…
            </p>
          ) : showStart ? (
            <StartForm
              me={state.me}
              firstFieldRef={firstFieldRef}
              whatsappHref={whatsappHref}
              onStarted={async () => {
                store.set(ACTIVE_KEY, "1");
                setNewChat(false);
                const data = await fetchChat(0, true);
                markSeen(data.messages);
              }}
            />
          ) : (
            <>
              <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-4" aria-label="Messages" data-testid="chat-messages" tabIndex={0}>
                {state.messages.map((m, i) => {
                  const prev = state.messages[i - 1];
                  const newDay = !prev || dayFmt.format(new Date(prev.created_at)) !== dayFmt.format(new Date(m.created_at));
                  const mine = m.sender === "customer";
                  return (
                    <li key={m.id} className="space-y-1" data-testid={mine ? "chat-msg-mine" : "chat-msg-store"}>
                      {newDay ? <p className="text-center text-[0.6875rem] text-muted">{dayFmt.format(new Date(m.created_at))}</p> : null}
                      <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[85%] rounded-card px-3 py-2 text-sm", mine ? "bg-ink text-surface" : "border border-stone bg-surface")}>
                          <span className="sr-only">{mine ? "You" : storeName}: </span>
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={cn("mt-1 text-right text-[0.6875rem]", mine ? "text-surface/70" : "text-muted")}>{timeFmt.format(new Date(m.created_at))}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="sr-only" aria-live="polite">
                {state.messages.at(-1)?.sender === "admin" ? `${storeName} replied: ${state.messages.at(-1)?.body}` : ""}
              </p>
              {closed ? (
                <div className="space-y-2 border-t border-stone p-4 text-sm">
                  <p className="text-ink-soft">This chat was closed by the store.</p>
                  <Button size="sm" onClick={() => setNewChat(true)}>
                    Start a new chat
                  </Button>
                </div>
              ) : (
                <Composer
                  firstFieldRef={firstFieldRef}
                  onSent={async () => {
                    await fetchChat(lastId);
                  }}
                />
              )}
            </>
          )}
        </section>
      ) : null}
    </>
  );
}

function StartForm({
  me,
  firstFieldRef,
  whatsappHref,
  onStarted,
}: {
  me: ChatState["me"];
  firstFieldRef: React.RefObject<(HTMLInputElement & HTMLTextAreaElement) | null>;
  whatsappHref: string | null;
  onStarted: () => Promise<void>;
}) {
  const uid = useId();
  const [values, setValues] = useState({ name: me.name, phone: me.phone ?? "", orderNumber: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof values, v: string) => setValues((x) => ({ ...x, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    const parsed = startChatSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201) {
        await onStarted();
        return;
      }
      if (body.fieldErrors) setErrors(body.fieldErrors);
      setServerError(body.error ?? "We couldn't start the chat. Please try again.");
    } catch {
      setServerError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = (k: "name" | "phone" | "orderNumber", label: string, props: React.ComponentProps<"input"> = {}, optional = false) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className="text-xs font-medium">
        {label}
        {optional ? <span className="font-normal text-muted"> (optional)</span> : null}
      </label>
      <input
        id={`${uid}-${k}`}
        ref={k === "name" ? firstFieldRef : undefined}
        value={values[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={Boolean(errors[k])}
        aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
        className={cn(inputClasses(Boolean(errors[k])), "mt-1 h-10")}
        {...props}
      />
      {errors[k] ? (
        <p id={`${uid}-${k}-err`} className="mt-1 text-xs text-sale">
          {errors[k]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="flex-1 space-y-3 overflow-y-auto p-4" aria-label="Start a chat">
      <p className="text-sm text-ink-soft">Ask about sizes, delivery or your order. Leave your number so we can reach you if you leave the page.</p>
      {serverError ? (
        <p role="alert" className="rounded-xs bg-sale-soft p-2 text-xs text-sale">
          {serverError}
        </p>
      ) : null}
      {field("name", "Your name", { autoComplete: "name" })}
      {field("phone", "Mobile number", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "0300 1234567" }, true)}
      {field("orderNumber", "Order number", { autoCapitalize: "characters", placeholder: "MF-…", className: cn(inputClasses(Boolean(errors.orderNumber)), "mt-1 h-10 font-mono uppercase") }, true)}
      <div>
        <label htmlFor={`${uid}-message`} className="text-xs font-medium">
          Message
        </label>
        <textarea
          id={`${uid}-message`}
          rows={3}
          maxLength={MAX_MESSAGE}
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? `${uid}-message-err` : undefined}
          className={cn(inputClasses(Boolean(errors.message)), "mt-1 h-auto py-2")}
        />
        {errors.message ? (
          <p id={`${uid}-message-err`} className="mt-1 text-xs text-sale">
            {errors.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Sending…" : "Start chat"}
      </Button>
      {whatsappHref ? (
        <p className="text-center text-xs text-muted">
          Prefer WhatsApp?{" "}
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-4">
            Message us there
          </a>
        </p>
      ) : null}
    </form>
  );
}

function Composer({ firstFieldRef, onSent }: { firstFieldRef: React.RefObject<(HTMLInputElement & HTMLTextAreaElement) | null>; onSent: () => Promise<void> }) {
  const uid = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const body = await res.json().catch(() => ({}));
      if (res.status === 201) {
        setText("");
        await onSent();
      } else setError(body.error ?? "Message not sent. Please try again.");
    } catch {
      setError("Network error — message not sent.");
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <form
      className="border-t border-stone p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {error ? (
        <p role="alert" className="mb-2 text-xs text-sale">
          {error}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <label htmlFor={`${uid}-text`} className="sr-only">
          Your message
        </label>
        <textarea
          id={`${uid}-text`}
          ref={firstFieldRef}
          rows={2}
          maxLength={MAX_MESSAGE}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a message…"
          className={cn(inputClasses(false), "h-auto resize-none py-2")}
        />
        <Button type="submit" size="sm" disabled={busy || !text.trim()} aria-label="Send message" className="h-11 w-11 shrink-0 px-0">
          <Icon name="send" className="size-5" />
        </Button>
      </div>
      <p className="mt-1 text-[0.6875rem] text-muted">Enter to send · Shift+Enter for a new line. Never share your PIN or OTP.</p>
    </form>
  );
}
