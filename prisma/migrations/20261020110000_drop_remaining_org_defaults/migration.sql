-- drop_user_role missed three columns that the organizations migration added in a multi-line
-- ALTER TABLE. No league-owned column may default to a league.
ALTER TABLE "players" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "league_settings" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "allowed_zip_codes" ALTER COLUMN "organizationId" DROP DEFAULT;
