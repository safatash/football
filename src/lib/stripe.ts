import Stripe from "stripe";

let client: Stripe | null = null;

/** Stripe client (created on first use so builds don't need the key). */
export function stripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return client;
}

export const appUrl = () => (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
