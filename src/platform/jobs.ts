/** Background jobs (Vercel Cron) run once per league that's in service. */
import { runWithOrg } from "./db";
import { activeOrganizations } from "./orgs";

/** Runs `job` as each active league in turn and returns the results by league slug. */
export async function forEachLeague<T>(job: () => Promise<T>): Promise<Record<string, T>> {
  const out: Record<string, T> = {};
  for (const org of await activeOrganizations()) out[org.slug] = await runWithOrg(org.id, job);
  return out;
}
