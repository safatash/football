/**
 * Browser error monitoring: Sentry when NEXT_PUBLIC_SENTRY_DSN is set; otherwise nothing loads
 * into Sentry and nothing is sent.
 */
import * as Sentry from "@sentry/nextjs";
import { privateDataCollection } from "@/lib/monitoring";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
    dataCollection: privateDataCollection(),
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
