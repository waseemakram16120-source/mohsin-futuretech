/** Liveness check used by deployment monitoring and the e2e smoke test. */
export function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() });
}
