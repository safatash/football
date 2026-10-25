/**
 * Error monitoring (Sentry). Everything here is a no-op unless SENTRY_DSN is set, so local
 * work, tests and previews without a DSN send nothing. No personal data: Sentry 11 collects
 * user info, cookies, headers, query strings and request bodies by default, and those would
 * include sign-in and registration details, so all of it is off (`privateDataCollection`).
 */
import * as Sentry from "@sentry/nextjs";

export const privateDataCollection = () => ({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] as never[], urlQueryParams: false });

export const monitoringEnabled = () => Boolean(process.env.SENTRY_DSN);

/** Server-side Sentry options (instrumentation.ts). */
export const serverSentryOptions = () => ({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  dataCollection: privateDataCollection(),
});

/** Reports an error we caught and handled (e.g. a server action's 500), with optional context. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!monitoringEnabled()) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
