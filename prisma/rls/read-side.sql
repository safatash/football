-- EXPERIMENT ONLY (backlog: "read-side RLS: try per-page transaction, re-measure").
-- Restricts reads too, on top of the writes-only migration 20261025000000_rls_writes. Measured on
-- Vercel it cost pages +13–31 ms p95 (docs/rls.md). Never apply outside a throwaway database.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'organizationId'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS league_read ON %I', t);
    EXECUTE format('CREATE POLICY league_read ON %I FOR SELECT USING ("organizationId" = current_setting(''app.org_id'', true))', t);
  END LOOP;
END $$;
