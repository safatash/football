/**
 * The current organization (league). Phase 1: the app serves NVASA only, so this is a constant.
 * Phase 2 resolves it per request from the host and replaces these helpers.
 */
export const NVASA_ORG_ID = "org_nvasa";

export function currentOrgId() {
  return NVASA_ORG_ID;
}

/** `include` for a user's player profile in the current league (a user has one per league). */
export const playerInOrg = () => ({ where: { organizationId: currentOrgId() }, take: 1 }) as const;
