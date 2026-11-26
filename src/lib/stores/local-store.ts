/**
 * Tiny external store persisted to localStorage, for React's
 * useSyncExternalStore. Values are validated with Zod on every read, so
 * corrupted or old data falls back to the empty value instead of crashing.
 * Changes in another tab are picked up through the "storage" event.
 */
import type { z } from "zod";

export interface LocalStore<T> {
  get(): T;
  set(updater: (current: T) => T): void;
  subscribe(listener: () => void): () => void;
  /** Snapshot used during server rendering / hydration. */
  getServerSnapshot(): T;
}

export function createLocalStore<T>(key: string, schema: z.ZodType<T>, empty: T): LocalStore<T> {
  let cache: T | undefined;
  let cacheRaw: string | null | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (typeof window === "undefined") return empty;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      raw = null; // storage blocked (private mode, etc.)
    }
    if (raw === cacheRaw && cache !== undefined) return cache;
    cacheRaw = raw;
    try {
      const parsed = schema.safeParse(raw ? JSON.parse(raw) : empty);
      cache = parsed.success ? parsed.data : empty;
    } catch {
      cache = empty;
    }
    return cache;
  };

  const emit = () => listeners.forEach((l) => l());

  return {
    get: read,
    getServerSnapshot: () => empty,
    set(updater) {
      const next = updater(read());
      const parsed = schema.safeParse(next);
      const value = parsed.success ? parsed.data : empty;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage full/blocked: keep the in-memory value for this session.
      }
      cache = value;
      cacheRaw = (() => {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return null;
        }
      })();
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
