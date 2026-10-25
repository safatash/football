-- Scheduling data (field availability, team blackouts), forfeits and point adjustments

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "forfeitTeamId" TEXT;

-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN     "forfeitGoals" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "field_availability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "seasonId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_blackouts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_blackouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "point_adjustments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_availability_fieldId_idx" ON "field_availability"("fieldId");

-- CreateIndex
CREATE INDEX "field_availability_organizationId_idx" ON "field_availability"("organizationId");

-- CreateIndex
CREATE INDEX "team_blackouts_organizationId_idx" ON "team_blackouts"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "team_blackouts_teamId_date_key" ON "team_blackouts"("teamId", "date");

-- CreateIndex
CREATE INDEX "point_adjustments_seasonId_teamId_idx" ON "point_adjustments"("seasonId", "teamId");

-- CreateIndex
CREATE INDEX "point_adjustments_organizationId_idx" ON "point_adjustments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "fields_id_organizationId_key" ON "fields"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "field_availability" ADD CONSTRAINT "field_availability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_availability" ADD CONSTRAINT "field_availability_fieldId_organizationId_fkey" FOREIGN KEY ("fieldId", "organizationId") REFERENCES "fields"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_availability" ADD CONSTRAINT "field_availability_seasonId_organizationId_fkey" FOREIGN KEY ("seasonId", "organizationId") REFERENCES "seasons"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_blackouts" ADD CONSTRAINT "team_blackouts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_blackouts" ADD CONSTRAINT "team_blackouts_teamId_organizationId_fkey" FOREIGN KEY ("teamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_adjustments" ADD CONSTRAINT "point_adjustments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_adjustments" ADD CONSTRAINT "point_adjustments_seasonId_organizationId_fkey" FOREIGN KEY ("seasonId", "organizationId") REFERENCES "seasons"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_adjustments" ADD CONSTRAINT "point_adjustments_teamId_organizationId_fkey" FOREIGN KEY ("teamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sane values
ALTER TABLE "field_availability" ADD CONSTRAINT "field_availability_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "field_availability" ADD CONSTRAINT "field_availability_window_check" CHECK ("startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute");

-- Row-level security for writes, like every league table (migration 20261025000000_rls_writes)
DO $$
DECLARE t text;
DECLARE league text := '"organizationId" = current_setting(''app.org_id'', true)';
BEGIN
  FOREACH t IN ARRAY ARRAY['field_availability', 'team_blackouts', 'point_adjustments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY league_read ON %I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY league_insert ON %I FOR INSERT WITH CHECK (%s)', t, league);
    EXECUTE format('CREATE POLICY league_update ON %I FOR UPDATE USING (%s) WITH CHECK (%s)', t, league, league);
    EXECUTE format('CREATE POLICY league_delete ON %I FOR DELETE USING (%s)', t, league);
  END LOOP;
END $$;
