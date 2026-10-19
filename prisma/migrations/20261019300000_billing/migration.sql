-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CHECK', 'ZELLE', 'VENMO', 'CARD_IN_PERSON', 'STRIPE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';
ALTER TYPE "PaymentStatus" ADD VALUE 'WAIVED';

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'WAIVER';

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "createdByAdminId" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "method" "PaymentMethod",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "recordedByUserId" TEXT,
ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Existing payments with Stripe ids were paid through Stripe
UPDATE "payments" SET "method" = 'STRIPE' WHERE "stripeChargeId" IS NOT NULL OR "stripePaymentIntentId" IS NOT NULL;
