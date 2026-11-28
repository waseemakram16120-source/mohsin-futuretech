"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { inputClasses } from "@/components/forms/Field";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/States";
import { formatPkPhone } from "@/lib/checkout/phone";
import { MAX_MESSAGE } from "@/lib/chat/schemas";
import { cn } from "@/lib/cn";

interface Conversation {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  order_number: string | null;
  user_id: string | null;
  status: "open" | "closed";
  last_message_at: string;
  last_message_preview: string;
  last_sender: "customer" | "admin" | null;
  unread_for_admin: number;
  profile: { email: string } | null;
}
interface Message {
  id: number;
  sender: "customer" | "admin";
  body: string;
  created_at: string;
  sender_profile: { full_name: string } | null;
}
interface Thread {
  conversation: Conversation & { created_at: string; profile: { email: string; full_name: string } | null };
  messages: Message[];
}

const LIST_POLL_MS = 8000;
const THREAD_POLL_MS = 4000;
const when = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Karachi" });

/** Customer chats: list on the left, conversation on the right (stacked on phones). */
export function AdminInbox({ initialId }: { initialId: string | null }) {
  const uid = useId();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [list, setList] = useState<Conversation[] | null>(null);
  const [selected, setSelected] = useState<string | null>(initialId);
  const [thread, setThread] = useState<Thread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const lastId = thread?.messages.at(-1)?.id ?? 0;

  const loadList = useCallback(async (status: "open" | "closed") => {
    const res = await fetch(`/api/admin/chat?status=${status}`, { cache: "no-store" });
    if (!res.ok) throw new Error("list");
    const data = (await res.json()) as { conversations: Conversation[]; waiting: number };
    setList(data.conversations);
    document.title = data.waiting ? `(${data.waiting}) Messages · Admin` : "Messages · Admin";
  }, []);

  const loadThread = useCallback(async (id: string, after: number, replace: boolean) => {
    const res = await fetch(`/api/admin/chat/${id}?after=${after}`, { cache: "no-store" });
    if (!res.ok) throw new Error("thread");
    const data = (await res.json()) as Thread;
    setThread((prev) => {
      if (replace || !prev || prev.conversation.id !== id) return data;
      const known = new Set(prev.messages.map((m) => m.id));
      return { conversation: data.conversation, messages: [...prev.messages, ...data.messages.filter((m) => !known.has(m.id))] };
    });
  }, []);

  // Inbox polling (also refreshes unread counts).
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        await loadList(tab);
        if (!cancelled) setError(null);
      } catch {
        if (!cancelled) setError("Could not load chats. Retrying…");
      }
    };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, LIST_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [tab, loadList]);

  // Thread polling for the open conversation.
  useEffect(() => {
    if (!selected) return;
    const id = window.setTimeout(
      () => {
        loadThread(selected, thread?.conversation.id === selected ? lastId : 0, thread?.conversation.id !== selected).catch(() => undefined);
      },
      thread?.conversation.id === selected ? THREAD_POLL_MS : 0,
    );
    return () => window.clearTimeout(id);
  }, [selected, lastId, thread, loadThread]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [lastId, selected]);

  const choose = (id: string | null) => {
    setSelected(id);
    setReply("");
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("c", id);
    else url.searchParams.delete("c");
    window.history.replaceState(window.history.state, "", url);
  };

  const post = async (payload: object) => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/chat/${selected}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (res.status !== 201) {
        setError(body.error ?? "Could not save. Please try again.");
        return false;
      }
      await Promise.all([loadThread(selected, lastId, false), loadList(tab)]);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    const text = reply.trim();
    if (!text) return;
    if (await post({ message: text })) setReply("");
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendReply();
    }
  };

  const c = thread?.conversation.id === selected ? thread.conversation : null;
  const waLink = c?.customer_phone ? `https://wa.me/92${c.customer_phone.slice(1)}` : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]" data-testid="admin-inbox">
      <section aria-label="Conversations" className={cn("rounded-card border border-stone bg-surface", selected && "hidden lg:block")}>
        <div className="flex gap-1 border-b border-stone p-2" role="tablist" aria-label="Chat status">
          {(["open", "closed"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setList(null);
              }}
              className={cn("h-9 flex-1 rounded-xs text-sm font-medium", tab === t ? "bg-ink text-surface" : "text-ink-soft hover:bg-sand")}
            >
              {t === "open" ? "Open" : "Closed"}
            </button>
          ))}
        </div>
        {error && !thread ? (
          <p role="alert" className="p-3 text-sm text-sale">
            {error}
          </p>
        ) : null}
        {list === null ? (
          <p className="p-4 text-sm text-muted" role="status">
            Loading…
          </p>
        ) : list.length === 0 ? (
          <div className="p-3">
            <EmptyState icon="chat" title={tab === "open" ? "No open chats" : "No closed chats"} description={tab === "open" ? "New customer messages appear here." : undefined} />
          </div>
        ) : (
          <ul className="max-h-[70vh] divide-y divide-stone overflow-y-auto">
            {list.map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => choose(conv.id)}
                  aria-current={selected === conv.id ? "true" : undefined}
                  className={cn("block w-full px-3 py-3 text-left hover:bg-sand/50", selected === conv.id && "bg-sand")}
                  data-testid="inbox-row"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", conv.unread_for_admin ? "font-semibold" : "font-medium")}>{conv.customer_name}</span>
                    <span className="shrink-0 text-[0.6875rem] text-muted">{when.format(new Date(conv.last_message_at))}</span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-ink-soft">
                      {conv.last_sender === "admin" ? "You: " : ""}
                      {conv.last_message_preview}
                    </span>
                    {conv.unread_for_admin ? (
                      <span className="min-w-5 shrink-0 rounded-full bg-sale px-1.5 text-center text-xs font-semibold leading-5 text-surface" data-testid="inbox-unread">
                        {conv.unread_for_admin}
                        <span className="sr-only"> unread</span>
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Conversation" className={cn("flex min-h-[28rem] flex-col rounded-card border border-stone bg-surface", !selected && "hidden lg:flex")} data-testid="inbox-thread">
        {!selected ? (
          <div className="m-auto p-6 text-center text-sm text-muted">Choose a conversation.</div>
        ) : !c ? (
          <p className="p-4 text-sm text-muted" role="status">
            Loading…
          </p>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone p-4">
              <div className="min-w-0">
                <button type="button" onClick={() => choose(null)} className="mb-1 text-xs underline underline-offset-4 lg:hidden">
                  ← All chats
                </button>
                <h2 className="font-semibold">
                  {c.customer_name} {c.status === "closed" ? <Badge>Closed</Badge> : null} {c.user_id ? <Badge tone="new">Account</Badge> : <Badge>Guest</Badge>}
                </h2>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft">
                  {c.customer_phone ? (
                    <>
                      <a href={`tel:${c.customer_phone}`} className="underline underline-offset-4">
                        {formatPkPhone(c.customer_phone)}
                      </a>
                      {waLink ? (
                        <a href={waLink} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                          WhatsApp
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <span>No phone given</span>
                  )}
                  {c.profile?.email ? <span>{c.profile.email}</span> : null}
                  {c.order_number ? (
                    <Link href={`/admin/orders/${c.order_number}`} className="font-mono underline underline-offset-4">
                      {c.order_number}
                    </Link>
                  ) : null}
                  {c.user_id ? (
                    <Link href={`/admin/customers/${c.user_id}`} className="underline underline-offset-4">
                      Customer profile
                    </Link>
                  ) : null}
                </p>
              </div>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => post({ status: c.status === "open" ? "closed" : "open" })}>
                {c.status === "open" ? "Close chat" : "Reopen"}
              </Button>
            </header>
            <ol ref={listRef} className="max-h-[55vh] flex-1 space-y-3 overflow-y-auto bg-paper p-4" aria-label={`Messages with ${c.customer_name}`} tabIndex={0} data-testid="thread-messages">
              {thread!.messages.map((m) => {
                const store = m.sender === "admin";
                return (
                  <li key={m.id} className={cn("flex", store ? "justify-end" : "justify-start")} data-testid={store ? "thread-msg-admin" : "thread-msg-customer"}>
                    <div className={cn("max-w-[80%] rounded-card px-3 py-2 text-sm", store ? "bg-ink text-surface" : "border border-stone bg-surface")}>
                      <span className="sr-only">{store ? `Store${m.sender_profile?.full_name ? ` (${m.sender_profile.full_name})` : ""}` : c.customer_name}: </span>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("mt-1 text-right text-[0.6875rem]", store ? "text-surface/70" : "text-muted")}>
                        {store && m.sender_profile?.full_name ? `${m.sender_profile.full_name} · ` : ""}
                        {when.format(new Date(m.created_at))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
            <form
              className="border-t border-stone p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void sendReply();
              }}
            >
              {error ? (
                <p role="alert" className="mb-2 text-xs text-sale">
                  {error}
                </p>
              ) : null}
              <div className="flex items-end gap-2">
                <label htmlFor={`${uid}-reply`} className="sr-only">
                  Reply to {c.customer_name}
                </label>
                <textarea
                  id={`${uid}-reply`}
                  rows={2}
                  maxLength={MAX_MESSAGE}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={c.status === "closed" ? "Replying reopens the chat…" : "Type a reply…"}
                  className={cn(inputClasses(false), "h-auto resize-none py-2")}
                />
                <Button type="submit" disabled={busy || !reply.trim()} aria-label="Send reply" className="h-11 w-11 shrink-0 px-0">
                  <Icon name="send" className="size-5" />
                </Button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
