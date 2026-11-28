/**
 * The project's Zod import. Importing through here guarantees the global
 * config is set before any schema in the importing module runs:
 * Zod probes for eval support with `Function("")`, which our CSP forbids
 * (it would only log a violation); jitless mode skips the probe.
 */
import { z } from "zod";

z.config({ jitless: true });

export { z };
export type { ZodError, ZodType } from "zod";
