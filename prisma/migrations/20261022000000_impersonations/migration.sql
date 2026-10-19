-- Phase 4: the operator acting as a league admin (support), with start/stop audit.
-- CreateTable
CREATE TABLE "impersonations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "impersonations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impersonations_userId_organizationId_idx" ON "impersonations"("userId", "organizationId");

-- AddForeignKey
ALTER TABLE "impersonations" ADD CONSTRAINT "impersonations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonations" ADD CONSTRAINT "impersonations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

