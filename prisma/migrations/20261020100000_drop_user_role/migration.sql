-- Phase 2: league roles live in organization_members (copied there by the organizations migration),
-- so the global users.role column goes away. Platform operators keep users."isPlatformAdmin".
ALTER TABLE "users" DROP COLUMN "role";
DROP TYPE "Role";

-- Every league-owned row must name its league explicitly now; the temporary 'org_nvasa'
-- defaults would silently put another league's rows into NVASA.
ALTER TABLE "seasons" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "divisions" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "teams" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "team_rosters" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "registrations" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "game_passes" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "matches" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "match_availability" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "match_rosters" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "match_roster_entries" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "match_reports" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "player_match_stats" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "parks" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "fields" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "captain_requests" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "suspensions" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "discount_codes" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "blocklist" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "positions" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "tshirt_sizes" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "audit_log" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "referees" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "match_officials" ALTER COLUMN "organizationId" DROP DEFAULT;
