import { PageHeading } from "@/components/league";
import { db, getOrgId } from "@/lib/db";
import { playerInOrg } from "@/lib/org";
import { getSession } from "@/lib/session";
import { StaffManager, type StaffRow } from "./staff-manager";

export const metadata = { title: "Staff" };

const ORDER = { OWNER: 0, ADMIN: 1, STAFF: 2, PLAYER: 3 } as const;

export default async function StaffPage() {
  const [orgId, session] = await Promise.all([getOrgId(), getSession()]);
  const members = await db.organizationMember.findMany({
    where: { role: { in: ["OWNER", "ADMIN", "STAFF"] }, status: { not: "REMOVED" } },
    include: { user: { select: { email: true, players: { ...playerInOrg(orgId), select: { firstName: true, lastName: true } } } } },
  });
  const rows: StaffRow[] = members
    .map((m) => ({
      id: m.id,
      email: m.user.email,
      name: m.user.players[0] ? `${m.user.players[0].firstName} ${m.user.players[0].lastName}` : null,
      role: m.role as StaffRow["role"],
      invited: m.status === "INVITED",
      self: m.userId === session?.user?.id,
    }))
    .sort((a, b) => ORDER[a.role] - ORDER[b.role] || a.email.localeCompare(b.email));
  return (
    <>
      <PageHeading title="Staff" sub="Who runs the league office. Admins can change everything; staff can look but not change." />
      <StaffManager rows={rows} canManage={session?.user?.isAdmin === true} />
    </>
  );
}
