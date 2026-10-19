/** League helpers shared by app code. The current league comes from `getOrgId()` (see db.ts). */
export { getOrgId, runWithOrg } from "./db";

/** NVASA's organization id (created by the organizations migration). */
export const NVASA_ORG_ID = "org_nvasa";

/** `include` for a user's player profile in one league (a user has one per league). */
export const playerInOrg = (orgId: string) => ({ where: { organizationId: orgId }, take: 1 }) as const;
