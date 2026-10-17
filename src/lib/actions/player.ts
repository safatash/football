"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { assertSeasonWritable } from "@/lib/queries/season";
import { getSession } from "@/lib/session";
import { ForbiddenError, UnauthorizedError } from "@/lib/team-access";
import { ActionError, runAction, type ActionResult } from "./result";

const Input = z.object({ teamId: z.string().trim().min(1).max(64), note: z.string().trim().max(1000).optional() });

/** A player asks to co-captain a team they play on. The league office decides. */
export async function requestCaptainAccess(input: z.input<typeof Input>): Promise<ActionResult> {
  return runAction(async () => {
    const data = Input.parse(input);
    const session = await getSession();
    const playerId = session?.user?.playerId;
    if (!playerId) throw new UnauthorizedError("Sign in to continue.");
    const membership = await prisma.teamRoster.findFirst({
      where: { playerId, teamId: data.teamId, leftAt: null, membershipType: "SEASONAL" },
      select: { isCaptain: true, team: { select: { seasonId: true } } },
    });
    if (!membership) throw new ForbiddenError("You can only ask to captain a team you play on.");
    if (membership.isCaptain) throw new ActionError("You already captain this team.", 409);
    await assertSeasonWritable(membership.team.seasonId);
    const pending = await prisma.captainRequest.findFirst({ where: { playerId, teamId: data.teamId, status: "PENDING" } });
    if (pending) throw new ActionError("You already have a request waiting for review.", 409);
    await prisma.captainRequest.create({ data: { playerId, teamId: data.teamId, note: data.note || null } });
    revalidatePath("/portal", "layout");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Request sent. Status: Pending review" };
  });
}
