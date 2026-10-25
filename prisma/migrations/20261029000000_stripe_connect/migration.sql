-- Stripe Connect (docs/payments-architecture.md): each league's Express account and fee
ALTER TABLE "organizations" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "stripeAccountUpdatedAt" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN "platformFeeBps" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "organizations" ADD COLUMN "legacyPlatformPayments" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "organizations_stripeAccountId_key" ON "organizations"("stripeAccountId");

-- Leagues that exist today already take payments on the platform's Stripe account: they keep doing
-- so until they connect their own account. New leagues have to connect first.
UPDATE "organizations" SET "legacyPlatformPayments" = true;

ALTER TABLE "payments" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "payments" ADD COLUMN "applicationFeeAmount" DECIMAL(10,2);

CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "account" TEXT,
    "leagueId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);
