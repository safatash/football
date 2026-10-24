-- Row-level security for writes (docs/rls.md, "Shipped: writes-only RLS").
--
-- Every table with an "organizationId" gets four policies. Reads stay open at the database level
-- (the scoped client filters them, and read-side RLS cost pages 13–31 ms p95 on Vercel). Writes
-- must match the league in `app.org_id`, which the scoped client sets per transaction with
-- set_config(..., true) when DB_RLS=on.
--
-- Roles:
--   * the table owner (DATABASE_URL: migrations, seed, crons, src/platform) isn't subject to RLS
--     (no FORCE ROW LEVEL SECURITY);
--   * app_tenant (NOLOGIN, created here) holds the app's privileges. The login role the app uses
--     (DATABASE_APP_URL, e.g. nvasa_app) is created per environment by `npm run db:app-role`,
--     because its password can't live in a migration.
--
-- A table added later needs the same four policies in its own migration
-- (tests/integration/isolation.test.ts checks every league table has them).

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
DECLARE league text := '"organizationId" = current_setting(''app.org_id'', true)';
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'organizationId'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- The prototype's read-and-write policy, where it was applied by hand
    EXECUTE format('DROP POLICY IF EXISTS league_isolation ON %I', t);
    EXECUTE format('CREATE POLICY league_read ON %I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY league_insert ON %I FOR INSERT WITH CHECK (%s)', t, league);
    EXECUTE format('CREATE POLICY league_update ON %I FOR UPDATE USING (%s) WITH CHECK (%s)', t, league, league);
    EXECUTE format('CREATE POLICY league_delete ON %I FOR DELETE USING (%s)', t, league);
  END LOOP;
END $$;
