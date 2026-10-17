-- CreateEnum
CREATE TYPE "GenderRule" AS ENUM ('WOMEN', 'MEN', 'COED');

-- CreateEnum
CREATE TYPE "PlayerBackground" AS ENUM ('NEW', 'RETURNING');

-- CreateEnum
CREATE TYPE "PlacementState" AS ENUM ('NONE', 'NEW', 'INFO_REQUESTED', 'WAITLISTED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'SUBMITTED', 'CONFIRMED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "MatchRosterStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "CaptainRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('BOARD', 'PROMO', 'TEAM_PAID');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- Gender: non-binary players (coed divisions only; enforced in code)
ALTER TYPE "Gender" ADD VALUE 'NON_BINARY';

-- RegistrationStatus: add SUBMITTED and make it the default. The type is swapped instead of
-- using ADD VALUE because a newly added enum value can't be used in the same transaction.
ALTER TYPE "RegistrationStatus" RENAME TO "RegistrationStatus_old";
CREATE TYPE "RegistrationStatus" AS ENUM ('SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
ALTER TABLE "registrations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "registrations" ALTER COLUMN "status" TYPE "RegistrationStatus" USING ("status"::text::"RegistrationStatus");
ALTER TABLE "registrations" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
DROP TYPE "RegistrationStatus_old";

-- Divisions: replace the "born after" fields with gender rule + "born on or before" cutoffs.
-- The old fields only ever held the 1900-01-01 placeholder, which carries no age rule; what they
-- did encode is which genders the division takes. Refuse to run if a real date is present so
-- nothing is silently lost.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "divisions"
    WHERE ("maleBirthDateAfter" IS NOT NULL AND "maleBirthDateAfter"::date <> DATE '1900-01-01')
       OR ("femaleBirthDateAfter" IS NOT NULL AND "femaleBirthDateAfter"::date <> DATE '1900-01-01')
  ) THEN
    RAISE EXCEPTION 'divisions has real *BirthDateAfter values; map them by hand before running league_core';
  END IF;
END $$;

ALTER TABLE "divisions"
ADD COLUMN     "code" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "genderRule" "GenderRule" NOT NULL DEFAULT 'COED',
ADD COLUMN     "maleBornOnOrBefore" DATE,
ADD COLUMN     "femaleBornOnOrBefore" DATE,
ADD COLUMN     "minAge" INTEGER NOT NULL DEFAULT 18;

UPDATE "divisions" SET "genderRule" = CASE
  WHEN "maleBirthDateAfter" IS NOT NULL AND "femaleBirthDateAfter" IS NULL THEN 'MEN'::"GenderRule"
  WHEN "femaleBirthDateAfter" IS NOT NULL AND "maleBirthDateAfter" IS NULL THEN 'WOMEN'::"GenderRule"
  ELSE 'COED'::"GenderRule"
END;

-- Codes for existing rows: a slug of the name; the seed sets the short codes (wp, md1, ...).
UPDATE "divisions" SET "code" = trim(both '-' from lower(regexp_replace("name", '[^A-Za-z0-9]+', '-', 'g')));
ALTER TABLE "divisions" ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "divisions" DROP COLUMN "maleBirthDateAfter",
DROP COLUMN "femaleBirthDateAfter";

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "code" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "homeField" TEXT,
ADD COLUMN     "shortName" TEXT;

-- AlterTable
ALTER TABLE "team_rosters" ADD COLUMN     "jerseyNumber" INTEGER;

-- AlterTable
ALTER TABLE "registrations" ADD COLUMN     "amountBeforeDiscount" DECIMAL(10,2),
ADD COLUMN     "background" "PlayerBackground" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "backupTeamId" TEXT,
ADD COLUMN     "captainNote" TEXT,
ADD COLUMN     "deniedMessage" TEXT,
ADD COLUMN     "deniedReason" TEXT,
ADD COLUMN     "discountCodeId" TEXT,
ADD COLUMN     "divisionId" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "placementState" "PlacementState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "preferredTeamId" TEXT,
ALTER COLUMN "selectedTeams" SET DEFAULT '[]';

-- Registrations: carry the legacy selectedTeams JSON (team names or ids) into the new columns.
UPDATE "registrations" r SET "preferredTeamId" = t."id"
FROM "teams" t
WHERE t."seasonId" = r."seasonId"
  AND r."selectedTeams" LIKE '[%'
  AND (t."id" = (r."selectedTeams"::jsonb ->> 0) OR t."name" = (r."selectedTeams"::jsonb ->> 0));
UPDATE "registrations" r SET "backupTeamId" = t."id"
FROM "teams" t
WHERE t."seasonId" = r."seasonId"
  AND r."selectedTeams" LIKE '[%'
  AND (t."id" = (r."selectedTeams"::jsonb ->> 1) OR t."name" = (r."selectedTeams"::jsonb ->> 1));
UPDATE "registrations" r SET "divisionId" = t."divisionId"
FROM "teams" t WHERE t."id" = r."preferredTeamId";
UPDATE "registrations" SET "background" = 'RETURNING' WHERE "registrationType" <> 'NEW_PLAYER';
UPDATE "registrations" SET "amountBeforeDiscount" = "totalAmount";
-- Unpaid registrations that still owe money are "Submitted", not yet pending review.
UPDATE "registrations" SET "status" = 'SUBMITTED'
WHERE "status" = 'PENDING' AND "paymentStatus" <> 'PAID' AND "totalAmount" > 0;

-- Registration numbers ("R-2041"): numbered from 2001 in submission order.
CREATE SEQUENCE "registrations_number_seq" AS INTEGER START WITH 2001 OWNED BY NONE;
ALTER TABLE "registrations" ADD COLUMN "number" INTEGER, ADD COLUMN "playerNote" TEXT;
UPDATE "registrations" r SET "number" = n.num
FROM (SELECT "id", 2000 + row_number() OVER (ORDER BY "submittedAt", "id") AS num FROM "registrations") n
WHERE n."id" = r."id";
SELECT setval('"registrations_number_seq"', GREATEST((SELECT max("number") FROM "registrations"), 2000));
ALTER TABLE "registrations" ALTER COLUMN "number" SET DEFAULT nextval('"registrations_number_seq"'),
ALTER COLUMN "number" SET NOT NULL;
ALTER SEQUENCE "registrations_number_seq" OWNED BY "registrations"."number";
CREATE UNIQUE INDEX "registrations_number_key" ON "registrations"("number");

-- Matches: game numbers (backfilled in date order per season), officials, report status.
ALTER TABLE "matches" ADD COLUMN     "gameNumber" INTEGER,
ADD COLUMN     "ref1" TEXT,
ADD COLUMN     "ref2" TEXT,
ADD COLUMN     "ref3" TEXT,
ADD COLUMN     "reportStatus" "ReportStatus" NOT NULL DEFAULT 'NOT_STARTED';
UPDATE "matches" m SET "gameNumber" = n.num
FROM (SELECT "id", row_number() OVER (PARTITION BY "seasonId" ORDER BY "scheduledAt", "id") AS num FROM "matches") n
WHERE n."id" = m."id";
ALTER TABLE "matches" ALTER COLUMN "gameNumber" SET NOT NULL;
-- divisionId becomes a real foreign key: clear any value that doesn't point at a division.
UPDATE "matches" SET "divisionId" = NULL
WHERE "divisionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "divisions" d WHERE d."id" = "matches"."divisionId");

-- AllowedZipCode: mark county ZIPs (everything seeded so far was Fairfax County)
ALTER TABLE "allowed_zip_codes" ADD COLUMN     "fairfaxCounty" BOOLEAN NOT NULL DEFAULT false;
UPDATE "allowed_zip_codes" SET "fairfaxCounty" = true;

-- CreateTable
CREATE TABLE "match_availability" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamRosterId" TEXT NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "note" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_rosters" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "MatchRosterStatus" NOT NULL DEFAULT 'DRAFT',
    "formation" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_roster_entries" (
    "id" TEXT NOT NULL,
    "matchRosterId" TEXT NOT NULL,
    "teamRosterId" TEXT NOT NULL,
    "lineupSlot" TEXT,

    CONSTRAINT "match_roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_reports" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "redCardNote" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_match_stats" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "yellow" INTEGER NOT NULL DEFAULT 0,
    "red" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_match_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captain_requests" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "registrationId" TEXT,
    "note" TEXT,
    "status" "CaptainRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "captain_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspensions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "DiscountKind" NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_settings" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "gamePassFee" DECIMAL(10,2) NOT NULL DEFAULT 15,
    "maxMatchRoster" INTEGER NOT NULL DEFAULT 18,
    "fairfaxCountyAllowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_availability_teamRosterId_idx" ON "match_availability"("teamRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "match_availability_matchId_teamRosterId_key" ON "match_availability"("matchId", "teamRosterId");

-- CreateIndex
CREATE INDEX "match_rosters_teamId_idx" ON "match_rosters"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "match_rosters_matchId_teamId_key" ON "match_rosters"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "match_roster_entries_teamRosterId_idx" ON "match_roster_entries"("teamRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "match_roster_entries_matchRosterId_teamRosterId_key" ON "match_roster_entries"("matchRosterId", "teamRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "match_roster_entries_matchRosterId_lineupSlot_key" ON "match_roster_entries"("matchRosterId", "lineupSlot");

-- CreateIndex
CREATE INDEX "match_reports_teamId_idx" ON "match_reports"("teamId");

-- CreateIndex
CREATE INDEX "match_reports_status_idx" ON "match_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "match_reports_matchId_teamId_key" ON "match_reports"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "player_match_stats_playerId_idx" ON "player_match_stats"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_match_stats_reportId_playerId_key" ON "player_match_stats"("reportId", "playerId");

-- CreateIndex
CREATE INDEX "captain_requests_status_idx" ON "captain_requests"("status");

-- CreateIndex
CREATE INDEX "captain_requests_playerId_idx" ON "captain_requests"("playerId");

-- CreateIndex
CREATE INDEX "captain_requests_teamId_idx" ON "captain_requests"("teamId");

-- CreateIndex
CREATE INDEX "suspensions_playerId_endsAt_idx" ON "suspensions"("playerId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");

-- CreateIndex
CREATE INDEX "discount_codes_seasonId_idx" ON "discount_codes"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "league_settings_seasonId_key" ON "league_settings"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "divisions_seasonId_code_key" ON "divisions"("seasonId", "code");

-- CreateIndex
CREATE INDEX "teams_divisionId_idx" ON "teams"("divisionId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_seasonId_code_key" ON "teams"("seasonId", "code");

-- CreateIndex
CREATE INDEX "team_rosters_teamId_leftAt_idx" ON "team_rosters"("teamId", "leftAt");

-- CreateIndex
CREATE INDEX "team_rosters_matchId_idx" ON "team_rosters"("matchId");

-- CreateIndex
CREATE INDEX "registrations_seasonId_status_idx" ON "registrations"("seasonId", "status");

-- CreateIndex
CREATE INDEX "registrations_playerId_idx" ON "registrations"("playerId");

-- CreateIndex
CREATE INDEX "registrations_placementState_idx" ON "registrations"("placementState");

-- CreateIndex
CREATE INDEX "game_passes_matchId_status_idx" ON "game_passes"("matchId", "status");

-- CreateIndex
CREATE INDEX "game_passes_status_validUntil_idx" ON "game_passes"("status", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "game_passes_playerId_matchId_key" ON "game_passes"("playerId", "matchId");

-- CreateIndex
CREATE INDEX "matches_seasonId_scheduledAt_idx" ON "matches"("seasonId", "scheduledAt");

-- CreateIndex
CREATE INDEX "matches_homeTeamId_idx" ON "matches"("homeTeamId");

-- CreateIndex
CREATE INDEX "matches_awayTeamId_idx" ON "matches"("awayTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "matches_seasonId_gameNumber_key" ON "matches"("seasonId", "gameNumber");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_preferredTeamId_fkey" FOREIGN KEY ("preferredTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_backupTeamId_fkey" FOREIGN KEY ("backupTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_discountCodeId_fkey" FOREIGN KEY ("discountCodeId") REFERENCES "discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_availability" ADD CONSTRAINT "match_availability_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_availability" ADD CONSTRAINT "match_availability_teamRosterId_fkey" FOREIGN KEY ("teamRosterId") REFERENCES "team_rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_rosters" ADD CONSTRAINT "match_rosters_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_rosters" ADD CONSTRAINT "match_rosters_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_roster_entries" ADD CONSTRAINT "match_roster_entries_matchRosterId_fkey" FOREIGN KEY ("matchRosterId") REFERENCES "match_rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_roster_entries" ADD CONSTRAINT "match_roster_entries_teamRosterId_fkey" FOREIGN KEY ("teamRosterId") REFERENCES "team_rosters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "match_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captain_requests" ADD CONSTRAINT "captain_requests_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captain_requests" ADD CONSTRAINT "captain_requests_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captain_requests" ADD CONSTRAINT "captain_requests_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_settings" ADD CONSTRAINT "league_settings_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

