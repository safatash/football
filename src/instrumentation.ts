/**
 * Server instrumentation: Sentry error monitoring when SENTRY_DSN is set (src/lib/monitoring.ts).
 * Without it nothing is initialized and onRequestError does nothing.
 */
import * as Sentry from "@sentry/nextjs";
import { monitoringEnabled, serverSentryOptions } from "@/lib/monitoring";

export async function register() {
  if (!monitoringEnabled()) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") Sentry.init(serverSentryOptions());
}

/** Errors in server components, route handlers and server actions that Next.js catches. */
export const onRequestError = Sentry.captureRequestError;
