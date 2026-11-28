/**
 * Small sliding-window rate limiter. In-memory, so on serverless it limits
 * per instance — a first line of defence against form spam; the database
 * functions still validate everything. Swap for a shared store (e.g. Upstash)
 * if abuse is seen in production.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSeconds: number } {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterSeconds: Math.ceil((windowMs - (now - recent[0])) / 1000) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 10_000) {
        // Bound memory: drop the oldest keys.
        for (const k of Array.from(hits.keys()).slice(0, 1000)) hits.delete(k);
      }
      return { ok: true };
    },
  };
}

/** Best-effort client IP behind Vercel / proxies. */
export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
