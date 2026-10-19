"use server";

/** Removes the seed's demo teams, matches and players. League-office only; asks for a typed confirmation. */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { CLEAR_DEMO_PHRASE, demoMatchWhere, demoUserWhere } from "@/lib/demo";
import { requireAdminUser } from "./admin-guard";
import { ActionError, runAction, type ActionResult } from "./result";

/**
 * Deletes, in order: rosters and game passes tied to demo matches or demo players, demo matches
 * (with their reports, match rosters and availability), demo teams (with their rosters),
 * demo players' registrations and payments, the demo accounts themselves, then demo parks and fields. Real players'
 * registrations that pointed at a demo team keep going, with the team cleared.
 */
export async function clearDemoData(input: { confirm: string }): Promise<ActionResult<{ teams: number; matches: number; players: number; parks: number; referees: number }>> {
  return runAction(async () => {
    const { confirm } = z.object({ confirm: z.string() }).parse(input);
    await requireAdminUser();
    if (confirm.trim().toLowerCase() !== CLEAR_DEMO_PHRASE) throw new ActionError(`Type “${CLEAR_DEMO_PHRASE}” to confirm.`, 400);

    const counts = await prisma.$transaction(
      async (tx) => {
        const [teams, matches, users] = await Promise.all([
          tx.team.findMany({ where: { isDemo: true }, select: { id: true } }),
          tx.match.findMany({ where: demoMatchWhere, select: { id: true } }),
          tx.user.findMany({ where: demoUserWhere, select: { id: true, player: { select: { id: true } } } }),
        ]);
        const teamIds = teams.map((t) => t.id);
        const matchIds = matches.map((m) => m.id);
        const playerIds = users.flatMap((u) => (u.player ? [u.player.id] : []));
        const passIds = (await tx.gamePass.findMany({ where: { OR: [{ matchId: { in: matchIds } }, { playerId: { in: playerIds } }] }, select: { id: true } })).map((p) => p.id);

        await tx.teamRoster.deleteMany({ where: { OR: [{ gamePassId: { in: passIds } }, { matchId: { in: matchIds } }] } });
        await tx.gamePass.deleteMany({ where: { id: { in: passIds } } });
        await tx.match.deleteMany({ where: { id: { in: matchIds } } });
        await tx.team.deleteMany({ where: { id: { in: teamIds } } });
        await tx.registration.deleteMany({ where: { playerId: { in: playerIds } } });
        await tx.payment.deleteMany({ where: { userId: { in: playerIds } } });
        await tx.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
        // Demo parks and their fields (any real match left on one keeps its stored label)
        const parks = await tx.park.findMany({ where: { isDemo: true }, select: { id: true } });
        await tx.field.deleteMany({ where: { parkId: { in: parks.map((p) => p.id) } } });
        await tx.park.deleteMany({ where: { id: { in: parks.map((p) => p.id) } } });
        // Demo referees, with any assignments they still have on real matches
        const refs = await tx.referee.findMany({ where: { isDemo: true }, select: { id: true } });
        await tx.matchOfficial.deleteMany({ where: { refereeId: { in: refs.map((r) => r.id) } } });
        await tx.referee.deleteMany({ where: { id: { in: refs.map((r) => r.id) } } });
        return { teams: teamIds.length, matches: matchIds.length, players: playerIds.length, parks: parks.length, referees: refs.length };
      },
      { timeout: 60_000 },
    );
    revalidatePath("/", "layout");
    return { ok: true, message: `Removed ${counts.teams} demo teams, ${counts.matches} matches, ${counts.players} players, ${counts.parks} parks and ${counts.referees} referees`, data: counts };
  });
}
