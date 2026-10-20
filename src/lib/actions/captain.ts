"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, leagueTransaction } from "@/lib/db";
import { now } from "@/lib/clock";
import { fullName } from "@/lib/format";
import { passExpired } from "@/lib/game-pass";
import { FORMATIONS } from "@/lib/formations";
import { sendMail } from "@/lib/mail";
import { teamUpdateEmail } from "@/lib/mail-templates";
import { validateLineup, validateMatchRoster, validateReport, type RosterCandidate } from "@/lib/match-rules";
import { activePassWhere, seasonalWhere } from "@/lib/queries/teams";
import { nextMatchFor } from "@/lib/queries/matches";
import { assertSeasonWritable, getSettings } from "@/lib/queries/season";
import { syncMatchReportStatus } from "@/lib/reports";
import { getSession } from "@/lib/session";
import { UnauthorizedError, requireCaptain } from "@/lib/team-access";
import { ActionError, runAction, type ActionResult } from "./result";

const Id = z.string().trim().min(1).max(64);

function revalidateTeam(teamId: string) {
  revalidatePath(`/captain/${teamId}`, "layout");
  revalidatePath("/portal", "layout");
}

/** A match the team plays in, in the team's season. */
async function teamMatch(teamId: string, seasonId: string, matchId: string) {
  const m = await db.match.findFirst({
    where: { id: matchId, seasonId, OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    select: { id: true, gameNumber: true, scheduledAt: true, status: true, homeTeamId: true, awayTeamId: true },
  });
  if (!m) throw new ActionError("That match isn’t on this team’s schedule.", 404);
  return m;
}

const activeSuspension = (at: Date) => ({ liftedAt: null, startsAt: { lte: at }, OR: [{ endsAt: null }, { endsAt: { gt: at } }] });

/* ------------------------------------------------------------------ */
/* Availability                                                        */
/* ------------------------------------------------------------------ */

const AvailabilityInput = z.object({
  teamId: Id,
  matchId: Id,
  /** Omit to set your own availability. */
  teamRosterId: Id.optional(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAYBE"]),
  note: z.string().trim().max(200).optional(),
});

/** Players set their own availability; captains (and admins) can set anyone's on their team. */
export async function setAvailability(input: z.input<typeof AvailabilityInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = AvailabilityInput.parse(input);
    const session = await getSession();
    if (!session?.user) throw new UnauthorizedError("Sign in to continue.");

    const team = await db.team.findUnique({ where: { id: data.teamId }, select: { id: true, seasonId: true } });
    if (!team) throw new ActionError("Team not found.", 404);
    const match = await teamMatch(team.id, team.seasonId, data.matchId);
    if (match.status !== "SCHEDULED") throw new ActionError("Availability is closed for this match.", 409);

    const row = data.teamRosterId
      ? await db.teamRoster.findFirst({ where: { id: data.teamRosterId, teamId: team.id, leftAt: null } })
      : await db.teamRoster.findFirst({
          where: { teamId: team.id, playerId: session.user.playerId ?? "-", leftAt: null, OR: [{ membershipType: "SEASONAL" }, { matchId: match.id }] },
        });
    if (!row) throw new ActionError("That player isn’t on this team.", 404);
    if (row.membershipType === "GAME_PASS" && row.matchId !== match.id) throw new ActionError("That game pass is for a different match.", 409);
    const own = row.playerId === session.user.playerId;
    if (!own) await requireCaptain(team.id);
    await assertSeasonWritable(team.seasonId);

    await db.matchAvailability.upsert({
      where: { matchId_teamRosterId: { matchId: match.id, teamRosterId: row.id } },
      update: { status: data.status, note: data.note ?? null, updatedById: session.user.id },
      create: { matchId: match.id, teamRosterId: row.id, status: data.status, note: data.note ?? null, updatedById: session.user.id },
    });
    revalidateTeam(team.id);
    return {
      ok: true,
      message: own
        ? data.status === "AVAILABLE"
          ? "You’re marked available"
          : data.status === "UNAVAILABLE"
            ? "Your captain will see you can’t make it"
            : "Marked as maybe"
        : "Availability updated",
    };
  });
}

/* ------------------------------------------------------------------ */
/* Lineup role (season roster screen)                                  */
/* ------------------------------------------------------------------ */

const RoleInput = z.object({ teamId: Id, teamRosterId: Id, role: z.enum(["Starter", "Bench", "Unavailable"]) });

/**
 * Sets a player's role for the team's next match: Starter / Bench (TeamRoster.lineupStatus) or
 * Unavailable (availability for that match). Bench and Unavailable also free their lineup spot
 * in a draft match roster.
 */
export async function setLineupRole(input: z.input<typeof RoleInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = RoleInput.parse(input);
    const { team, user } = await requireCaptain(data.teamId);
    await assertSeasonWritable(team.seasonId);
    const row = await db.teamRoster.findFirst({ where: { id: data.teamRosterId, teamId: team.id, ...seasonalWhere }, include: { player: { select: { status: true } } } });
    if (!row) throw new ActionError("That player isn’t on this team’s season roster.", 404);
    if (row.player.status === "SUSPENDED") throw new ActionError("Suspended players can’t be given a lineup role.", 409);

    const next = await nextMatchFor(team.id, team.seasonId);
    await db.$transaction(async (tx) => {
      await tx.teamRoster.update({
        where: { id: row.id },
        data: { lineupStatus: data.role === "Starter" ? "STARTING" : data.role === "Bench" ? "BENCH" : "INACTIVE" },
      });
      if (!next) return;
      const status = data.role === "Unavailable" ? "UNAVAILABLE" : "AVAILABLE";
      await tx.matchAvailability.upsert({
        where: { matchId_teamRosterId: { matchId: next.id, teamRosterId: row.id } },
        update: { status, updatedById: user.id },
        create: { matchId: next.id, teamRosterId: row.id, status, updatedById: user.id },
      });
      if (data.role !== "Starter") {
        await tx.matchRosterEntry.updateMany({
          where: { teamRosterId: row.id, matchRoster: { matchId: next.id, teamId: team.id, status: "DRAFT" } },
          data: { lineupSlot: null },
        });
      }
    });
    revalidateTeam(team.id);
    return { ok: true, message: `Role updated: ${data.role}` };
  });
}

/* ------------------------------------------------------------------ */
/* Team update email                                                   */
/* ------------------------------------------------------------------ */

const UpdateInput = z.object({ teamId: Id, message: z.string().trim().min(1, "Write a message first.").max(2000) });

/** Emails the season roster plus active game-pass players for the next match. */
export async function sendTeamUpdate(input: z.input<typeof UpdateInput>): Promise<ActionResult<{ recipients: number }>> {
  return runAction(async () => {
    const data = UpdateInput.parse(input);
    const { team, user, emails, sender } = await leagueTransaction(async () => {
      const { team, user } = await requireCaptain(data.teamId);
      await assertSeasonWritable(team.seasonId);
      const next = await nextMatchFor(team.id, team.seasonId);
      const rows = await db.teamRoster.findMany({
        where: { teamId: team.id, OR: [seasonalWhere, ...(next ? [{ ...activePassWhere(), matchId: next.id }] : [])] },
        select: { player: { select: { user: { select: { email: true } } } } },
      });
      const emails = [...new Set(rows.map((r) => r.player.user.email))];
      const sender = user.playerId ? await db.player.findUnique({ where: { id: user.playerId }, select: { firstName: true, lastName: true } }) : null;
      return { team, user, emails, sender };
    });
    const mail = await teamUpdateEmail({ teamName: team.name, captainName: sender ? fullName(sender) : "The league office", message: data.message, teamId: team.id });
    const res = await sendMail({ to: emails, ...mail, replyTo: user.email ?? undefined });
    if (res.failed && !res.sent && !res.logged) throw new ActionError("We couldn’t send the update. Try again in a moment.", 409);
    return { ok: true, message: `Update sent to ${emails.length} players`, data: { recipients: emails.length } };
  }, { transaction: false });
}

/* ------------------------------------------------------------------ */
/* Match roster                                                        */
/* ------------------------------------------------------------------ */

const RosterInput = z.object({ teamId: Id, matchId: Id, teamRosterIds: z.array(Id).max(60), finalize: z.boolean() });

/**
 * Saves the match roster as a draft or finalizes it. Server rules: at most maxMatchRoster players,
 * no suspended players, game-pass players only for the match their pass covers; finalizing also
 * needs a goalkeeper. Unavailable players are allowed and come back as warnings.
 */
export async function saveMatchRoster(input: z.input<typeof RosterInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = RosterInput.parse(input);
    const { team, user } = await requireCaptain(data.teamId);
    await assertSeasonWritable(team.seasonId);
    const match = await teamMatch(team.id, team.seasonId, data.matchId);
    if (match.status !== "SCHEDULED") throw new ActionError("This match has been played; its roster can’t change.", 409);

    const existing = await db.matchRoster.findUnique({ where: { matchId_teamId: { matchId: match.id, teamId: team.id } }, include: { entries: true } });
    if (existing?.status === "FINALIZED") throw new ActionError("This roster is finalized. Reopen it to make changes.", 409);

    const at = now();
    const ids = [...new Set(data.teamRosterIds)];
    const rows = await db.teamRoster.findMany({
      where: { id: { in: ids }, teamId: team.id, leftAt: null },
      select: {
        id: true,
        membershipType: true,
        matchId: true,
        player: { select: { firstName: true, lastName: true, position: true, status: true, suspensions: { where: activeSuspension(at), select: { id: true } } } },
        gamePass: { select: { matchId: true, status: true, validUntil: true } },
        matchAvailability: { where: { matchId: match.id }, select: { status: true } },
      },
    });
    if (rows.length !== ids.length) throw new ActionError("Some players aren’t on this team.", 400);

    const candidates: RosterCandidate[] = rows.map((r) => ({
      teamRosterId: r.id,
      name: fullName(r.player),
      position: r.player.position,
      suspended: r.player.status === "SUSPENDED" || r.player.suspensions.length > 0,
      gamePass: r.membershipType === "GAME_PASS",
      passMatchId: r.gamePass?.matchId ?? r.matchId,
      passValid: !!r.gamePass && r.gamePass.status === "ACTIVE" && !passExpired(r.gamePass, at),
      availability: r.matchAvailability[0]?.status ?? null,
    }));
    const { maxMatchRoster } = await getSettings(team.seasonId);
    const { errors, warnings } = validateMatchRoster(candidates, { matchId: match.id, max: maxMatchRoster });
    const blocking = data.finalize ? errors : errors.filter((e) => e !== "Pick at least one goalkeeper." && e !== "Pick at least one player.");
    if (blocking.length) throw new ActionError(blocking[0], 400, blocking);

    await db.$transaction(async (tx) => {
      const roster =
        existing ??
        (await tx.matchRoster.create({ data: { matchId: match.id, teamId: team.id, status: "DRAFT", formation: "4-4-2" }, include: { entries: true } }));
      const keep = new Set(ids);
      await tx.matchRosterEntry.deleteMany({ where: { matchRosterId: roster.id, teamRosterId: { notIn: ids } } });
      const have = new Set(roster.entries.filter((e) => keep.has(e.teamRosterId)).map((e) => e.teamRosterId));
      const add = ids.filter((id) => !have.has(id));
      if (add.length) await tx.matchRosterEntry.createMany({ data: add.map((teamRosterId) => ({ matchRosterId: roster.id, teamRosterId })) });
      await tx.matchRoster.update({
        where: { id: roster.id },
        data: data.finalize ? { status: "FINALIZED", finalizedAt: at, finalizedById: user.id } : { status: "DRAFT" },
      });
    });
    revalidateTeam(team.id);
    revalidatePath(`/matches/${match.gameNumber}/print`);
    return { ok: true, message: data.finalize ? "Roster finalized" : "Draft saved", warnings };
  });
}

const MatchRef = z.object({ teamId: Id, matchId: Id });

export async function reopenMatchRoster(input: z.input<typeof MatchRef>): Promise<ActionResult> {
  return runAction(async () => {
    const data = MatchRef.parse(input);
    const { team } = await requireCaptain(data.teamId);
    await assertSeasonWritable(team.seasonId);
    const match = await teamMatch(team.id, team.seasonId, data.matchId);
    if (match.status !== "SCHEDULED") throw new ActionError("This match has been played; its roster can’t change.", 409);
    const res = await db.matchRoster.updateMany({
      where: { matchId: match.id, teamId: team.id, status: "FINALIZED" },
      data: { status: "DRAFT", finalizedAt: null, finalizedById: null },
    });
    if (!res.count) throw new ActionError("This roster isn’t finalized.", 409);
    revalidateTeam(team.id);
    return { ok: true, message: "Roster reopened" };
  });
}

/* ------------------------------------------------------------------ */
/* Lineup                                                              */
/* ------------------------------------------------------------------ */

const LineupInput = z.object({
  teamId: Id,
  matchId: Id,
  formation: z.string().max(10),
  slots: z.record(z.string().max(8), Id.nullable()),
});

/** Saves formation and lineup slots. Every slotted player must be on the finalized match roster. */
export async function saveLineup(input: z.input<typeof LineupInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = LineupInput.parse(input);
    const { team } = await requireCaptain(data.teamId);
    await assertSeasonWritable(team.seasonId);
    const match = await teamMatch(team.id, team.seasonId, data.matchId);
    const shape = FORMATIONS[data.formation];
    if (!shape) throw new ActionError("Pick a formation.", 400);
    const roster = await db.matchRoster.findUnique({ where: { matchId_teamId: { matchId: match.id, teamId: team.id } }, include: { entries: true } });
    if (!roster || roster.status !== "FINALIZED") throw new ActionError("Finalize the match roster before saving the lineup.", 409);

    const errors = validateLineup(data.slots, new Set(roster.entries.map((e) => e.teamRosterId)), shape.map(([slot]) => slot));
    if (errors.length) throw new ActionError(errors[0], 400, errors);

    await db.$transaction(async (tx) => {
      await tx.matchRosterEntry.updateMany({ where: { matchRosterId: roster.id }, data: { lineupSlot: null } });
      for (const [slot, teamRosterId] of Object.entries(data.slots)) {
        if (!teamRosterId) continue;
        await tx.matchRosterEntry.update({ where: { matchRosterId_teamRosterId: { matchRosterId: roster.id, teamRosterId } }, data: { lineupSlot: slot } });
      }
      await tx.matchRoster.update({ where: { id: roster.id }, data: { formation: data.formation } });
    });
    revalidateTeam(team.id);
    return { ok: true, message: "Lineup saved" };
  });
}

/* ------------------------------------------------------------------ */
/* Match report                                                        */
/* ------------------------------------------------------------------ */

const Count = z.number().int().min(0).max(99);
const ReportInput = z.object({
  teamId: Id,
  matchId: Id,
  homeScore: Count,
  awayScore: Count,
  redCardNote: z.string().trim().max(2000).optional().default(""),
  stats: z
    .array(z.object({ playerId: Id, goals: Count, assists: Count, card: z.enum(["y", "r"]).nullable().optional() }))
    .max(60),
  submit: z.boolean(),
});

/**
 * Saves the team's match report as a draft or submits it. Submitting checks that player goals add
 * up to the team's score and that a red card has a note; a submitted report is locked.
 */
export async function saveMatchReport(input: z.input<typeof ReportInput>): Promise<ActionResult> {
  return runAction(async () => {
    const data = ReportInput.parse(input);
    const { team, user } = await requireCaptain(data.teamId);
    await assertSeasonWritable(team.seasonId);
    const match = await teamMatch(team.id, team.seasonId, data.matchId);
    if (match.scheduledAt > now() || match.status === "CANCELLED") throw new ActionError("Reports open after kickoff.", 409);

    const existing = await db.matchReport.findUnique({ where: { matchId_teamId: { matchId: match.id, teamId: team.id } } });
    if (existing && (existing.status === "SUBMITTED" || existing.status === "CONFIRMED")) {
      throw new ActionError("This report has been submitted and is locked. Contact the league office to change it.", 409);
    }

    // Stats only for players who were on this team for the match
    const playerIds = [...new Set(data.stats.map((s) => s.playerId))];
    const members = await db.teamRoster.findMany({
      where: { teamId: team.id, playerId: { in: playerIds }, OR: [{ membershipType: "SEASONAL" }, { matchId: match.id }] },
      select: { playerId: true, player: { select: { firstName: true, lastName: true } } },
    });
    const nameOf = new Map(members.map((m) => [m.playerId, fullName(m.player)]));
    if (playerIds.some((id) => !nameOf.has(id))) throw new ActionError("Some players in the report aren’t on this team.", 400);

    const stats = data.stats
      .map((s) => ({ playerId: s.playerId, goals: s.goals, assists: s.assists, yellow: s.card === "y" ? 1 : 0, red: s.card === "r" ? 1 : 0 }))
      .filter((s) => s.goals || s.assists || s.yellow || s.red);
    const ours = match.homeTeamId === team.id ? data.homeScore : data.awayScore;
    const theirs = match.homeTeamId === team.id ? data.awayScore : data.homeScore;
    if (data.submit) {
      const errors = validateReport({ teamScore: ours, opponentScore: theirs, stats: stats.map((s) => ({ ...s, name: nameOf.get(s.playerId)! })), redCardNote: data.redCardNote });
      if (errors.length) throw new ActionError(errors[0], 400, errors);
    }

    const at = now();
    await db.$transaction(async (tx) => {
      const report = await tx.matchReport.upsert({
        where: { matchId_teamId: { matchId: match.id, teamId: team.id } },
        update: {
          homeScore: data.homeScore,
          awayScore: data.awayScore,
          redCardNote: data.redCardNote || null,
          status: data.submit ? "SUBMITTED" : "DRAFT",
          ...(data.submit ? { submittedAt: at, submittedById: user.id } : {}),
        },
        create: {
          matchId: match.id,
          teamId: team.id,
          homeScore: data.homeScore,
          awayScore: data.awayScore,
          redCardNote: data.redCardNote || null,
          status: data.submit ? "SUBMITTED" : "DRAFT",
          ...(data.submit ? { submittedAt: at, submittedById: user.id } : {}),
        },
      });
      await tx.playerMatchStat.deleteMany({ where: { reportId: report.id } });
      if (stats.length) await tx.playerMatchStat.createMany({ data: stats.map((s) => ({ ...s, reportId: report.id })) });
      await syncMatchReportStatus(tx, match.id, at);
    });
    revalidateTeam(team.id);
    revalidatePath("/admin", "layout");
    return { ok: true, message: data.submit ? "Report submitted to the league office" : "Report draft saved" };
  });
}
