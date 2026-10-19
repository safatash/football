import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { playerInOrg, currentOrgId } from "@/lib/org";
import { accountPasswordErrors, hashPassword } from "@/lib/password";
import { checkEligibility } from "@/lib/eligibility";
import { getActiveSeason } from "@/lib/queries/season";
import { blocklistHit } from "@/lib/queries/registrations";
import { priceWithCode, countDiscountUse } from "@/lib/registration";
import { getSession } from "@/lib/session";
import { appUrl, stripe } from "@/lib/stripe";
import { regNumber } from "@/lib/format";
import { sendMail } from "@/lib/mail";
import { registrationReceivedEmail } from "@/lib/mail-templates";

const text = (max: number) => z.string().trim().max(max);
const GENDER = { Female: "FEMALE", Male: "MALE", "Non-binary": "NON_BINARY", FEMALE: "FEMALE", MALE: "MALE", NON_BINARY: "NON_BINARY" } as const;

/** Season fields every registration sends. */
const SeasonFields = z.object({
  divisionCode: text(20).min(1, "Please choose a division."),
  preferredTeamId: text(64).nullish(),
  backupTeamId: text(64).nullish(),
  background: z.enum(["New", "Returning"]).optional(),
  level: text(40).optional(),
  captainRequest: z.boolean().optional().default(false),
  captainNote: text(1000).optional(),
  discountCode: text(40).optional().default(""),
});

/** Account + profile fields for a brand-new player. */
const NewPlayer = SeasonFields.extend({
  firstName: text(50).min(1, "Please add your first name."),
  lastName: text(50).min(1, "Please add your last name."),
  email: text(254).toLowerCase().email("Enter a valid email address."),
  password: z.string().max(200),
  phone: text(30).refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number."),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please add your date of birth."),
  gender: z.enum(["Female", "Male", "Non-binary", "FEMALE", "MALE", "NON_BINARY"], { message: "Please choose a gender." }),
  address: text(120).min(1, "Please add your street address."),
  city: text(60).min(1, "Please add your city."),
  state: text(2).min(2, "Please add your state."),
  zip: text(10).regex(/^\d{5}$/, "Enter a 5-digit ZIP code."),
  position: text(20).min(1, "Please choose a position."),
  tshirtSize: text(20).min(1, "Please choose a T-shirt size."),
  contactMe: z.boolean().optional().default(false),
  social: z.boolean().optional().default(false),
  tournaments: z.boolean().optional().default(false),
});

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Season registration. Signed-in players register on their existing profile (returning player or
 * additional team); everyone else creates an account and profile. Eligibility, fee and discount
 * are computed here, never taken from the client.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const session = await getSession();
    const returningPlayerId = session?.user?.playerId ?? null;

    const parsed = returningPlayerId ? SeasonFields.safeParse(raw) : NewPlayer.safeParse(raw);
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Check your details and try again.");
    const data = parsed.data;

    const season = await getActiveSeason();
    if (!season?.isActive) return bad("Registration isn’t open right now. Check back soon.");

    // Who is registering
    let player: { id: string; dob: Date; gender: "MALE" | "FEMALE" | "NON_BINARY"; email: string; firstName: string; lastName: string } | null = null;
    if (returningPlayerId) {
      const p = await prisma.player.findUnique({ where: { id: returningPlayerId }, include: { user: { select: { email: true } } } });
      if (!p) return bad("We couldn’t find your player profile. Log in again.", 401);
      if (p.status === "INACTIVE") return bad("Your account isn’t active. Contact office@nvasa.org.", 403);
      player = { id: p.id, dob: p.dob, gender: p.gender, email: p.user.email, firstName: p.firstName, lastName: p.lastName };
    }
    const np = returningPlayerId ? null : (data as z.infer<typeof NewPlayer>);
    const email = player?.email ?? np!.email;
    const dob = player?.dob ?? new Date(`${np!.dob}T00:00:00Z`);
    const gender = player?.gender ?? GENDER[np!.gender];

    if (np) {
      const pwErrors = accountPasswordErrors(np.password);
      if (pwErrors.length) return bad(pwErrors.join(", "));
    }

    // Division and eligibility (server-side, from Division columns)
    const division = await prisma.division.findUnique({ where: { seasonId_code: { seasonId: season.id, code: data.divisionCode } } });
    if (!division || division.status !== "ACTIVE") return bad("Please choose a division.");
    const elig = checkEligibility(division, { dob, gender }, season.startDate);
    if (!elig.ok) return bad(`You can’t register for ${division.name}: ${elig.reason}.`);

    // Teams must be active teams in that division
    const preferredTeamId = data.preferredTeamId || null;
    const backupTeamId = preferredTeamId ? data.backupTeamId || null : null;
    if (backupTeamId && backupTeamId === preferredTeamId) return bad("Pick a different backup team than your first choice.");
    const teamIds = [preferredTeamId, backupTeamId].filter((x): x is string => !!x);
    if (teamIds.length) {
      const ok = await prisma.team.count({ where: { id: { in: teamIds }, divisionId: division.id, seasonId: season.id, status: { not: "INACTIVE" } } });
      if (ok !== teamIds.length) return bad(`Choose teams from ${division.name}.`);
    }

    // Price
    const priced = await priceWithCode({ fee: Number(division.registrationFee), code: data.discountCode, season, teamId: preferredTeamId });
    if (!priced.ok) return bad(priced.message);
    const free = priced.total === 0;

    // Account checks
    if (np) {
      const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
      if (existing) return bad("That email already has an NVASA account. Log in or use Find my player info instead.");
    }
    if (await blocklistHit(email)) return bad("This email is not eligible for registration. Contact office@nvasa.org.");

    let registrationType: "NEW_PLAYER" | "RETURNING_PLAYER" | "ADDITIONAL_TEAM" = "NEW_PLAYER";
    if (player) {
      const dup = await prisma.registration.findFirst({
        where: { playerId: player.id, seasonId: season.id, divisionId: division.id, status: { in: ["SUBMITTED", "PENDING", "APPROVED"] } },
      });
      if (dup) return bad(`You already have a ${division.name} registration for ${season.name}. Check My registrations.`);
      const onTeam = await prisma.teamRoster.count({ where: { playerId: player.id, leftAt: null, membershipType: "SEASONAL", team: { seasonId: season.id } } });
      registrationType = onTeam ? "ADDITIONAL_TEAM" : "RETURNING_PLAYER";
    }

    const allowedZip = np ? await prisma.allowedZipCode.findUnique({ where: { organizationId_zipCode: { organizationId: currentOrgId(), zipCode: np.zip } } }) : null;
    const preferredTeam = preferredTeamId ? await prisma.team.findUnique({ where: { id: preferredTeamId }, select: { name: true } }) : null;
    const backupTeam = backupTeamId ? await prisma.team.findUnique({ where: { id: backupTeamId }, select: { name: true } }) : null;
    const captainNote = data.captainRequest ? data.captainNote?.trim() || null : null;

    const registration = await prisma.$transaction(async (tx) => {
      let playerId = player?.id;
      if (np) {
        const user = await tx.user.create({
          data: {
            email,
            password: await hashPassword(np.password),
            memberships: { create: { organizationId: currentOrgId(), role: "PLAYER", joinedAt: new Date() } },
            players: {
              create: {
                organizationId: currentOrgId(),
                firstName: np.firstName,
                lastName: np.lastName,
                gender,
                dob,
                phone: np.phone,
                address: np.address,
                city: np.city,
                state: np.state.toUpperCase(),
                zip: np.zip,
                county: allowedZip?.county ?? null,
                position: np.position,
                tshirtSize: np.tshirtSize,
                contactMe: np.contactMe,
                social: np.social,
                tournaments: np.tournaments,
                finalApproval: "NEEDS_REVIEW",
                status: "ACTIVE",
              },
            },
          },
          include: { players: playerInOrg() },
        });
        playerId = user.players[0]!.id;
      }

      const reg = await tx.registration.create({
        data: {
          playerId: playerId!,
          seasonId: season.id,
          registrationType,
          divisionId: division.id,
          preferredTeamId,
          backupTeamId,
          background: player ? "RETURNING" : data.background === "Returning" ? "RETURNING" : "NEW",
          level: data.level || null,
          captainNote,
          selectedTeams: JSON.stringify([preferredTeam?.name, backupTeam?.name].filter(Boolean)),
          captainRequests: data.captainRequest && preferredTeam ? JSON.stringify([preferredTeam.name]) : null,
          placementState: preferredTeamId ? "NONE" : "NEW",
          amountBeforeDiscount: priced.fee,
          totalAmount: priced.total,
          discountCodeId: priced.discountId,
          // Free registrations go straight to review; paid ones wait for the Stripe webhook
          status: free ? "PENDING" : "SUBMITTED",
          paymentStatus: free ? "PAID" : "UNPAID",
        },
      });
      if (data.captainRequest && preferredTeamId) {
        await tx.captainRequest.create({ data: { playerId: playerId!, teamId: preferredTeamId, registrationId: reg.id, note: captainNote } });
      }
      if (free && priced.discountId) await countDiscountUse(tx, priced.discountId);
      return reg;
    });

    if (free) {
      await sendMail({
        to: email,
        ...registrationReceivedEmail({
          firstName: player?.firstName ?? np!.firstName,
          seasonName: season.name,
          divisionName: division.name,
          number: regNumber(registration.number),
          paid: true,
        }),
      });
      return NextResponse.json({ success: true, checkoutUrl: `/register/success?registration=${registration.id}` });
    }

    const name = player ? `${player.firstName} ${player.lastName}` : `${np!.firstName} ${np!.lastName}`;
    const checkout = await stripe().checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `NVASA ${season.name} · ${division.name}`, description: `${season.name} · ${name}` },
            unit_amount: Math.round(priced.total * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appUrl()}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/register/new`,
      client_reference_id: registration.id,
      customer_email: email,
      metadata: {
        type: "registration",
        registrationId: registration.id,
        playerId: registration.playerId,
        division: division.name,
        discountCode: data.discountCode.toUpperCase(),
      },
    });

    return NextResponse.json({ success: true, checkoutUrl: checkout.url });
  } catch (error) {
    console.error("Registration error:", error);
    return bad("We couldn’t finish your registration. Please try again, or email office@nvasa.org.", 500);
  }
}
