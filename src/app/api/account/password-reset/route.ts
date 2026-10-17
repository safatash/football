import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { passwordResetEmail } from "@/lib/mail-templates";
import { appUrl } from "@/lib/stripe";
import { createToken } from "@/lib/tokens";

const Body = z.object({ email: z.string().trim().email().max(254) });

/** Sends a password reset link. Answers the same way whether or not the email has an account. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const user = await prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } }, include: { player: true } });
  if (user && user.player?.status !== "INACTIVE") {
    const token = await createToken("reset", user.id);
    await sendMail({ to: user.email, ...passwordResetEmail({ firstName: user.player?.firstName ?? "there", url: `${appUrl()}/login/reset?token=${token}` }) });
  }
  return NextResponse.json({ ok: true });
}
