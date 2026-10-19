import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getActiveSeason } from "@/lib/queries/season";
import { priceWithCode } from "@/lib/registration";

const Body = z.object({
  code: z.string().max(40),
  divisionCode: z.string().max(20),
  preferredTeamId: z.string().max(64).nullish(),
});

/** Checks a discount code for the registration wizard. The registration route re-checks on submit. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "Enter a code first." }, { status: 400 });
  const season = await getActiveSeason();
  if (!season) return NextResponse.json({ ok: false, message: "Registration isn’t open right now." }, { status: 409 });
  const division = await prisma.division.findUnique({ where: { seasonId_code: { seasonId: season.id, code: parsed.data.divisionCode } } });
  if (!division || division.status !== "ACTIVE") return NextResponse.json({ ok: false, message: "Choose a division first." }, { status: 400 });
  const res = await priceWithCode({ fee: Number(division.registrationFee), code: parsed.data.code, season, teamId: parsed.data.preferredTeamId ?? null });
  if (!res.ok) return NextResponse.json({ ok: false, message: res.message });
  return NextResponse.json({ ok: true, discount: res.discount, total: res.total });
}
