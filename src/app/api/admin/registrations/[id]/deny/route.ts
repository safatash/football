import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";

const Body = z.object({
  reason: z.string().trim().min(1, "Choose a reason.").max(200),
  message: z.string().trim().max(2000).optional(),
});

class ConflictError extends Error {}

/** Deny a registration. The reason and message are validated and logged; there is no column for them yet. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (!session.user.isAdmin) return NextResponse.json({ error: "Only the league office can deny registrations." }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    if (registration.status !== "PENDING") {
      return NextResponse.json({ error: `This registration is already ${registration.status === "REJECTED" ? "denied" : registration.status.toLowerCase()}.` }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.registration.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "REJECTED", rejectedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictError();
      await tx.player.update({ where: { id: registration.playerId }, data: { finalApproval: "REJECTED" } });
    });

    console.info("Registration denied", { id, by: session.user.email, reason: parsed.data.reason, message: parsed.data.message });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ConflictError) return NextResponse.json({ error: "This registration was already decided." }, { status: 409 });
    console.error("Deny registration failed", error);
    return NextResponse.json({ error: "Couldn’t deny this registration. Try again." }, { status: 500 });
  }
}
