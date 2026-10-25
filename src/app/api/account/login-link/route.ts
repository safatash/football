import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { playerInOrg, getOrgId } from "@/lib/org";
import { sendMail } from "@/lib/mail";
import { loginLinkEmail } from "@/lib/mail-templates";
import { appUrl } from "@/lib/branding";
import { createToken } from "@/lib/tokens";
import { LIMITS, clientIp, hitAll, honeypotFilled, rateKey, tooMany } from "@/platform/rate-limit";

const Body = z.object({ email: z.string().trim().email().max(254), dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/**
 * "Email me a login link" from Find my player info. Needs the same email + date of birth as the
 * lookup, and answers the same way whether or not they match.
 */
export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and date of birth." }, { status: 400 });
  const { email, dob } = parsed.data;
  const limited = await hitAll([
    [rateKey("recovery-ip", await clientIp(req)), LIMITS.recoveryIp],
    [rateKey("recovery-email", email), LIMITS.recoveryEmail],
  ]);
  if (!limited.ok) return tooMany(limited);
  // Bots fill the hidden field: answer as usual, send nothing
  if (honeypotFilled(raw)) return NextResponse.json({ ok: true });
  const user = await db.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, include: { players: playerInOrg(await getOrgId()) } });
  if (user?.players[0] && user.players[0].dob.toISOString().slice(0, 10) === dob && user.players[0].status !== "INACTIVE") {
    const token = await createToken("login", user.id);
    await sendMail({ to: user.email, ...(await loginLinkEmail({ firstName: user.players[0].firstName, url: `${(await appUrl())}/login/link?token=${token}` })) });
  }
  return NextResponse.json({ ok: true });
}
