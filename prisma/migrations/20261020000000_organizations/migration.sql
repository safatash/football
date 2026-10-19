-- Phase 1 of multi-tenancy: NVASA becomes the first organization and owns all existing data.
-- Additive except for two NVASA-specific flags, which are converted to data before they're dropped:
--   players.fairfaxCounty / allowed_zip_codes.fairfaxCounty  -> county = 'Fairfax County, VA'
--   league_settings.fairfaxCountyAllowed                      -> organization_settings.eligibilityMode

CREATE TYPE "OrganizationStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'PLAYER');
CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'ACTIVE', 'REMOVED');
CREATE TYPE "TieBreaker" AS ENUM ('GOAL_DIFFERENCE', 'GOALS_FOR', 'HEAD_TO_HEAD', 'FEWEST_GOALS_AGAINST');
CREATE TYPE "EligibilityMode" AS ENUM ('NONE', 'ZIP_LIST', 'COUNTY_LIST');

CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "customDomain" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "accentColor" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "contactEmail" TEXT,
    "supportEmail" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'TRIAL',
    "plan" TEXT NOT NULL DEFAULT 'pilot',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'PLAYER',
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "gamePassesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gamePassFee" DECIMAL(10,2) NOT NULL DEFAULT 15,
    "maxMatchRoster" INTEGER NOT NULL DEFAULT 18,
    "pointsWin" INTEGER NOT NULL DEFAULT 3,
    "pointsDraw" INTEGER NOT NULL DEFAULT 1,
    "pointsLoss" INTEGER NOT NULL DEFAULT 0,
    "tieBreakers" "TieBreaker"[] DEFAULT ARRAY['GOAL_DIFFERENCE', 'GOALS_FOR']::"TieBreaker"[],
    "eligibilityMode" "EligibilityMode" NOT NULL DEFAULT 'NONE',
    "eligibleCounties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "waiverText" TEXT,
    "waiverRequired" BOOLEAN NOT NULL DEFAULT true,
    "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "organizations" ("id", "name", "slug", "status", "plan", "contactEmail", "supportEmail", "timezone", "updatedAt")
VALUES ('org_nvasa', 'NVASA', 'nvasa', 'ACTIVE', 'founding', 'office@nvasa.org', 'office@nvasa.org', 'America/New_York', CURRENT_TIMESTAMP);

-- League-wide settings, taken from the active season (else the newest one)
INSERT INTO "organization_settings" ("id", "organizationId", "gamePassFee", "maxMatchRoster", "eligibilityMode", "eligibleCounties", "updatedAt")
SELECT 'orgset_nvasa', 'org_nvasa',
       coalesce(ls."gamePassFee", 15), coalesce(ls."maxMatchRoster", 18),
       CASE WHEN coalesce(ls."fairfaxCountyAllowed", true) THEN 'COUNTY_LIST'::"EligibilityMode" ELSE 'ZIP_LIST'::"EligibilityMode" END,
       ARRAY['Fairfax County, VA'], CURRENT_TIMESTAMP
FROM (SELECT 1) one
LEFT JOIN LATERAL (
  SELECT l.* FROM "league_settings" l JOIN "seasons" s ON s."id" = l."seasonId"
  ORDER BY s."isActive" DESC, s."startDate" DESC LIMIT 1
) ls ON true;

-- Fairfax flags become counties
ALTER TABLE "players" ADD COLUMN "county" TEXT;
UPDATE "players" SET "county" = 'Fairfax County, VA' WHERE "fairfaxCounty";
ALTER TABLE "allowed_zip_codes" ADD COLUMN "county" TEXT;
UPDATE "allowed_zip_codes" SET "county" = 'Fairfax County, VA' WHERE "fairfaxCounty";

-- Memberships: the operator account owns NVASA, league-office admins are admins, everyone else plays
INSERT INTO "organization_members" ("id", "userId", "organizationId", "role", "status", "joinedAt", "updatedAt")
SELECT 'mem_' || md5(u."id"), u."id", 'org_nvasa',
       CASE WHEN lower(u."email") = 'safatash@gmail.com' THEN 'OWNER'::"OrgRole"
            WHEN u."role" = 'ADMIN' THEN 'ADMIN'::"OrgRole"
            ELSE 'PLAYER'::"OrgRole" END,
       'ACTIVE', u."createdAt", CURRENT_TIMESTAMP
FROM "users" u;

ALTER TABLE "divisions" DROP CONSTRAINT "divisions_seasonId_fkey";

ALTER TABLE "teams" DROP CONSTRAINT "teams_seasonId_fkey";

ALTER TABLE "teams" DROP CONSTRAINT "teams_divisionId_fkey";

ALTER TABLE "team_rosters" DROP CONSTRAINT "team_rosters_playerId_fkey";

ALTER TABLE "team_rosters" DROP CONSTRAINT "team_rosters_teamId_fkey";

ALTER TABLE "team_rosters" DROP CONSTRAINT "team_rosters_divisionId_fkey";

ALTER TABLE "registrations" DROP CONSTRAINT "registrations_playerId_fkey";

ALTER TABLE "registrations" DROP CONSTRAINT "registrations_seasonId_fkey";

ALTER TABLE "game_passes" DROP CONSTRAINT "game_passes_playerId_fkey";

ALTER TABLE "game_passes" DROP CONSTRAINT "game_passes_matchId_fkey";

ALTER TABLE "game_passes" DROP CONSTRAINT "game_passes_paymentId_fkey";

ALTER TABLE "matches" DROP CONSTRAINT "matches_seasonId_fkey";

ALTER TABLE "matches" DROP CONSTRAINT "matches_homeTeamId_fkey";

ALTER TABLE "matches" DROP CONSTRAINT "matches_awayTeamId_fkey";

ALTER TABLE "match_availability" DROP CONSTRAINT "match_availability_matchId_fkey";

ALTER TABLE "match_availability" DROP CONSTRAINT "match_availability_teamRosterId_fkey";

ALTER TABLE "match_rosters" DROP CONSTRAINT "match_rosters_matchId_fkey";

ALTER TABLE "match_rosters" DROP CONSTRAINT "match_rosters_teamId_fkey";

ALTER TABLE "match_roster_entries" DROP CONSTRAINT "match_roster_entries_matchRosterId_fkey";

ALTER TABLE "match_roster_entries" DROP CONSTRAINT "match_roster_entries_teamRosterId_fkey";

ALTER TABLE "match_reports" DROP CONSTRAINT "match_reports_matchId_fkey";

ALTER TABLE "match_reports" DROP CONSTRAINT "match_reports_teamId_fkey";

ALTER TABLE "player_match_stats" DROP CONSTRAINT "player_match_stats_reportId_fkey";

ALTER TABLE "player_match_stats" DROP CONSTRAINT "player_match_stats_playerId_fkey";

ALTER TABLE "fields" DROP CONSTRAINT "fields_parkId_fkey";

ALTER TABLE "captain_requests" DROP CONSTRAINT "captain_requests_playerId_fkey";

ALTER TABLE "captain_requests" DROP CONSTRAINT "captain_requests_teamId_fkey";

ALTER TABLE "suspensions" DROP CONSTRAINT "suspensions_playerId_fkey";

ALTER TABLE "discount_codes" DROP CONSTRAINT "discount_codes_seasonId_fkey";

ALTER TABLE "league_settings" DROP CONSTRAINT "league_settings_seasonId_fkey";

ALTER TABLE "payments" DROP CONSTRAINT "payments_userId_fkey";

ALTER TABLE "match_officials" DROP CONSTRAINT "match_officials_matchId_fkey";

ALTER TABLE "match_officials" DROP CONSTRAINT "match_officials_refereeId_fkey";

DROP INDEX "players_userId_key";

DROP INDEX "players_legacyKey_key";

DROP INDEX "seasons_name_key";

DROP INDEX "seasons_slug_key";

DROP INDEX "seasons_legacyDatasource_key";

DROP INDEX "teams_paidInFullCode_key";

DROP INDEX "registrations_number_key";

DROP INDEX "parks_name_key";

DROP INDEX "fields_legacyId_key";

DROP INDEX "discount_codes_code_key";

DROP INDEX "blocklist_email_key";

DROP INDEX "allowed_zip_codes_zipCode_key";

DROP INDEX "positions_name_key";

DROP INDEX "tshirt_sizes_size_key";

ALTER TABLE "users" ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "players" DROP COLUMN "fairfaxCounty",
ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "seasons" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "divisions" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "teams" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "team_rosters" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "registrations" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa',
ADD COLUMN     "waiverAcceptedAt" TIMESTAMP(3);

ALTER TABLE "game_passes" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "matches" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "match_availability" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "match_rosters" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "match_roster_entries" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "match_reports" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "player_match_stats" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "parks" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "fields" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "captain_requests" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "suspensions" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "discount_codes" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "league_settings" DROP COLUMN "fairfaxCountyAllowed",
ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa',
ALTER COLUMN "gamePassFee" DROP NOT NULL,
ALTER COLUMN "gamePassFee" DROP DEFAULT,
ALTER COLUMN "maxMatchRoster" DROP NOT NULL,
ALTER COLUMN "maxMatchRoster" DROP DEFAULT;

ALTER TABLE "payments" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "blocklist" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "allowed_zip_codes" DROP COLUMN "fairfaxCounty",
ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "positions" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "tshirt_sizes" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "audit_log" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "referees" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

ALTER TABLE "match_officials" ADD COLUMN     "organizationId" TEXT NOT NULL DEFAULT 'org_nvasa';

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

CREATE UNIQUE INDEX "organizations_customDomain_key" ON "organizations"("customDomain");

CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");

CREATE UNIQUE INDEX "organization_members_userId_organizationId_key" ON "organization_members"("userId", "organizationId");

CREATE UNIQUE INDEX "organization_settings_organizationId_key" ON "organization_settings"("organizationId");

CREATE INDEX "players_organizationId_idx" ON "players"("organizationId");

CREATE UNIQUE INDEX "players_userId_organizationId_key" ON "players"("userId", "organizationId");

CREATE UNIQUE INDEX "players_organizationId_legacyKey_key" ON "players"("organizationId", "legacyKey");

CREATE UNIQUE INDEX "players_id_organizationId_key" ON "players"("id", "organizationId");

CREATE INDEX "seasons_organizationId_idx" ON "seasons"("organizationId");

CREATE UNIQUE INDEX "seasons_organizationId_name_key" ON "seasons"("organizationId", "name");

CREATE UNIQUE INDEX "seasons_organizationId_slug_key" ON "seasons"("organizationId", "slug");

CREATE UNIQUE INDEX "seasons_organizationId_legacyDatasource_key" ON "seasons"("organizationId", "legacyDatasource");

CREATE UNIQUE INDEX "seasons_id_organizationId_key" ON "seasons"("id", "organizationId");

CREATE INDEX "divisions_organizationId_idx" ON "divisions"("organizationId");

CREATE UNIQUE INDEX "divisions_id_organizationId_key" ON "divisions"("id", "organizationId");

CREATE INDEX "teams_organizationId_idx" ON "teams"("organizationId");

CREATE UNIQUE INDEX "teams_organizationId_paidInFullCode_key" ON "teams"("organizationId", "paidInFullCode");

CREATE UNIQUE INDEX "teams_id_organizationId_key" ON "teams"("id", "organizationId");

CREATE INDEX "team_rosters_organizationId_idx" ON "team_rosters"("organizationId");

CREATE UNIQUE INDEX "team_rosters_id_organizationId_key" ON "team_rosters"("id", "organizationId");

CREATE INDEX "registrations_organizationId_idx" ON "registrations"("organizationId");

CREATE UNIQUE INDEX "registrations_organizationId_number_key" ON "registrations"("organizationId", "number");

CREATE INDEX "game_passes_organizationId_idx" ON "game_passes"("organizationId");

CREATE UNIQUE INDEX "game_passes_paymentId_organizationId_key" ON "game_passes"("paymentId", "organizationId");

CREATE INDEX "matches_organizationId_idx" ON "matches"("organizationId");

CREATE UNIQUE INDEX "matches_id_organizationId_key" ON "matches"("id", "organizationId");

CREATE INDEX "match_availability_organizationId_idx" ON "match_availability"("organizationId");

CREATE INDEX "match_rosters_organizationId_idx" ON "match_rosters"("organizationId");

CREATE UNIQUE INDEX "match_rosters_id_organizationId_key" ON "match_rosters"("id", "organizationId");

CREATE INDEX "match_roster_entries_organizationId_idx" ON "match_roster_entries"("organizationId");

CREATE INDEX "match_reports_organizationId_idx" ON "match_reports"("organizationId");

CREATE UNIQUE INDEX "match_reports_id_organizationId_key" ON "match_reports"("id", "organizationId");

CREATE INDEX "player_match_stats_organizationId_idx" ON "player_match_stats"("organizationId");

CREATE INDEX "parks_organizationId_idx" ON "parks"("organizationId");

CREATE UNIQUE INDEX "parks_organizationId_name_key" ON "parks"("organizationId", "name");

CREATE UNIQUE INDEX "parks_id_organizationId_key" ON "parks"("id", "organizationId");

CREATE INDEX "fields_organizationId_idx" ON "fields"("organizationId");

CREATE UNIQUE INDEX "fields_organizationId_legacyId_key" ON "fields"("organizationId", "legacyId");

CREATE INDEX "captain_requests_organizationId_idx" ON "captain_requests"("organizationId");

CREATE INDEX "suspensions_organizationId_idx" ON "suspensions"("organizationId");

CREATE INDEX "discount_codes_organizationId_idx" ON "discount_codes"("organizationId");

CREATE UNIQUE INDEX "discount_codes_organizationId_code_key" ON "discount_codes"("organizationId", "code");

CREATE INDEX "league_settings_organizationId_idx" ON "league_settings"("organizationId");

CREATE UNIQUE INDEX "league_settings_seasonId_organizationId_key" ON "league_settings"("seasonId", "organizationId");

CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");

CREATE UNIQUE INDEX "payments_id_organizationId_key" ON "payments"("id", "organizationId");

CREATE INDEX "blocklist_organizationId_idx" ON "blocklist"("organizationId");

CREATE UNIQUE INDEX "blocklist_organizationId_email_key" ON "blocklist"("organizationId", "email");

CREATE INDEX "allowed_zip_codes_organizationId_idx" ON "allowed_zip_codes"("organizationId");

CREATE UNIQUE INDEX "allowed_zip_codes_organizationId_zipCode_key" ON "allowed_zip_codes"("organizationId", "zipCode");

CREATE INDEX "positions_organizationId_idx" ON "positions"("organizationId");

CREATE UNIQUE INDEX "positions_organizationId_name_key" ON "positions"("organizationId", "name");

CREATE INDEX "tshirt_sizes_organizationId_idx" ON "tshirt_sizes"("organizationId");

CREATE UNIQUE INDEX "tshirt_sizes_organizationId_size_key" ON "tshirt_sizes"("organizationId", "size");

CREATE INDEX "audit_log_organizationId_idx" ON "audit_log"("organizationId");

CREATE INDEX "referees_organizationId_idx" ON "referees"("organizationId");

CREATE UNIQUE INDEX "referees_id_organizationId_key" ON "referees"("id", "organizationId");

CREATE INDEX "match_officials_organizationId_idx" ON "match_officials"("organizationId");

ALTER TABLE "players" ADD CONSTRAINT "players_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "seasons" ADD CONSTRAINT "seasons_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "divisions" ADD CONSTRAINT "divisions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "divisions" ADD CONSTRAINT "divisions_seasonId_organizationId_fkey" FOREIGN KEY ("seasonId", "organizationId") REFERENCES "seasons"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "teams" ADD CONSTRAINT "teams_seasonId_organizationId_fkey" FOREIGN KEY ("seasonId", "organizationId") REFERENCES "seasons"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teams" ADD CONSTRAINT "teams_divisionId_organizationId_fkey" FOREIGN KEY ("divisionId", "organizationId") REFERENCES "divisions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_rosters" ADD CONSTRAINT "team_rosters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_rosters" ADD CONSTRAINT "team_rosters_playerId_organizationId_fkey" FOREIGN KEY ("playerId", "organizationId") REFERENCES "players"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_rosters" ADD CONSTRAINT "team_rosters_teamId_organizationId_fkey" FOREIGN KEY ("teamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_rosters" ADD CONSTRAINT "team_rosters_divisionId_organizationId_fkey" FOREIGN KEY ("divisionId", "organizationId") REFERENCES "divisions"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_playerId_organizationId_fkey" FOREIGN KEY ("playerId", "organizationId") REFERENCES "players"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registrations" ADD CONSTRAINT "registrations_seasonId_organizationId_fkey" FOREIGN KEY ("seasonId", "organizationId") REFERENCES "seasons"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_passes" ADD CONSTRAINT "game_passes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "game_passes" ADD CONSTRAINT "game_passes_playerId_organizationId_fkey" FOREIGN KEY ("playerId", "organizationId") REFERENCES "players"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "game_passes" ADD CONSTRAINT "game_passes_matchId_organizationId_fkey" FOREIGN KEY ("matchId", "organizationId") REFERENCES "matches"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "game_passes" ADD CONSTRAINT "game_passes_paymentId_organizationId_fkey" FOREIGN KEY ("paymentId", "organizationId") REFERENCES "payments"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "matches" ADD CONSTRAINT "matches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "matches" ADD CONSTRAINT "matches_seasonId_organizationId_fkey" FOREIGN KEY ("seasonId", "organizationId") REFERENCES "seasons"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "matches" ADD CONSTRAINT "matches_homeTeamId_organizationId_fkey" FOREIGN KEY ("homeTeamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "matches" ADD CONSTRAINT "matches_awayTeamId_organizationId_fkey" FOREIGN KEY ("awayTeamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_availability" ADD CONSTRAINT "match_availability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_availability" ADD CONSTRAINT "match_availability_matchId_organizationId_fkey" FOREIGN KEY ("matchId", "organizationId") REFERENCES "matches"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_availability" ADD CONSTRAINT "match_availability_teamRosterId_organizationId_fkey" FOREIGN KEY ("teamRosterId", "organizationId") REFERENCES "team_rosters"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_rosters" ADD CONSTRAINT "match_rosters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_rosters" ADD CONSTRAINT "match_rosters_matchId_organizationId_fkey" FOREIGN KEY ("matchId", "organizationId") REFERENCES "matches"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_rosters" ADD CONSTRAINT "match_rosters_teamId_organizationId_fkey" FOREIGN KEY ("teamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_roster_entries" ADD CONSTRAINT "match_roster_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_roster_entries" ADD CONSTRAINT "match_roster_entries_matchRosterId_organizationId_fkey" FOREIGN KEY ("matchRosterId", "organizationId") REFERENCES "match_rosters"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_roster_entries" ADD CONSTRAINT "match_roster_entries_teamRosterId_organizationId_fkey" FOREIGN KEY ("teamRosterId", "organizationId") REFERENCES "team_rosters"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_matchId_organizationId_fkey" FOREIGN KEY ("matchId", "organizationId") REFERENCES "matches"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_reports" ADD CONSTRAINT "match_reports_teamId_organizationId_fkey" FOREIGN KEY ("teamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_reportId_organizationId_fkey" FOREIGN KEY ("reportId", "organizationId") REFERENCES "match_reports"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "player_match_stats" ADD CONSTRAINT "player_match_stats_playerId_organizationId_fkey" FOREIGN KEY ("playerId", "organizationId") REFERENCES "players"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parks" ADD CONSTRAINT "parks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fields" ADD CONSTRAINT "fields_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fields" ADD CONSTRAINT "fields_parkId_organizationId_fkey" FOREIGN KEY ("parkId", "organizationId") REFERENCES "parks"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "captain_requests" ADD CONSTRAINT "captain_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "captain_requests" ADD CONSTRAINT "captain_requests_playerId_organizationId_fkey" FOREIGN KEY ("playerId", "organizationId") REFERENCES "players"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "captain_requests" ADD CONSTRAINT "captain_requests_teamId_organizationId_fkey" FOREIGN KEY ("teamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "suspensions" ADD CONSTRAINT "suspensions_playerId_organizationId_fkey" FOREIGN KEY ("playerId", "organizationId") REFERENCES "players"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "discount_codes" ADD CONSTRAINT "discount_codes_seasonId_organizationId_fkey" FOREIGN KEY ("seasonId", "organizationId") REFERENCES "seasons"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "league_settings" ADD CONSTRAINT "league_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "league_settings" ADD CONSTRAINT "league_settings_seasonId_organizationId_fkey" FOREIGN KEY ("seasonId", "organizationId") REFERENCES "seasons"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "players"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "blocklist" ADD CONSTRAINT "blocklist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "allowed_zip_codes" ADD CONSTRAINT "allowed_zip_codes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "positions" ADD CONSTRAINT "positions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tshirt_sizes" ADD CONSTRAINT "tshirt_sizes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "referees" ADD CONSTRAINT "referees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_officials" ADD CONSTRAINT "match_officials_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match_officials" ADD CONSTRAINT "match_officials_matchId_organizationId_fkey" FOREIGN KEY ("matchId", "organizationId") REFERENCES "matches"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_officials" ADD CONSTRAINT "match_officials_refereeId_organizationId_fkey" FOREIGN KEY ("refereeId", "organizationId") REFERENCES "referees"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The operator
UPDATE "users" SET "isPlatformAdmin" = true WHERE lower("email") = 'safatash@gmail.com';
