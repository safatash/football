-- Fixed-window rate-limit counters (platform-level, no league data)
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key","windowStart")
);

CREATE INDEX "rate_limits_windowStart_idx" ON "rate_limits"("windowStart");
