import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { captainedTeams } from "@/lib/team-access";

/** /captain opens the first team the user captains. */
export default async function CaptainIndexPage() {
  const session = await requireUser("/captain");
  const [first] = await captainedTeams(session.user.playerId);
  if (first) redirect(`/captain/${first.id}`);
  if (session.user.isAdmin) redirect("/admin/teams");
  redirect("/portal?notice=no-team");
}
