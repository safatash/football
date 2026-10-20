/** The league-scoped client for app code (implemented in the platform layer). */
export { db, getDb, getOrgId, runWithOrg, leagueTransaction, assertNoLeagueTransaction, NoOrganizationError, ORG_MODELS, type DbTx, type ScopedClient } from "@/platform/db";
