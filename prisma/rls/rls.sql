-- Phase 2b prototype: Postgres row-level security on every league-owned table.
--
-- LOCAL ONLY for now. This file is deliberately outside prisma/migrations so `prisma migrate
-- deploy` never applies it to Neon. Apply it with `npm run db:rls` (scripts/rls-local.ts), which
-- refuses non-local hosts. See docs/rls.md.
--
-- Roles:
--   * the table owner (DATABASE_URL: migrations, seed, crons, src/platform) is not subject to RLS
--     because the tables are not FORCE ROW LEVEL SECURITY;
--   * app_tenant (NOLOGIN) holds the app's table privileges; the app logs in as a role that is a
--     member of it (DATABASE_APP_URL, created by the script) and sees only the rows of the league
--     in `app.org_id`, which the scoped client sets per transaction with set_config(..., true).
--
-- Without app.org_id the policies compare against NULL (or '' after a transaction ended), so a
-- query that forgot to set it returns no rows and every write fails the WITH CHECK.
--
-- Idempotent: re-running it picks up tables added since (any table with an "organizationId").

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_tenant;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant;
REVOKE ALL ON "_prisma_migrations" FROM app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tenant;

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'organizationId'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS league_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY league_isolation ON %I USING ("organizationId" = current_setting(''app.org_id'', true)) WITH CHECK ("organizationId" = current_setting(''app.org_id'', true))',
      t
    );
  END LOOP;
END $$;
