import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { ageOn } from "@/lib/eligibility";
import { accountPasswordErrors, hashPassword } from "@/lib/password";
import { getActiveSeason } from "@/lib/queries/season";
import { blocklistHit } from "@/lib/queries/registrations";

const Body = z.object({
  name: z.string().trim().min(3).max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth."),
  gender: z.enum(["Female", "Male", "Non-binary"], { message: "Choose a gender." }),
  phone: z.string().trim().max(30).refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a 10-digit mobile number."),
  password: z.string().max(200),
});
const GENDER = { Female: "FEMALE", Male: "MALE", "Non-binary": "NON_BINARY" } as const;

/**
 * A minimal player profile for someone buying their first game pass: name, email, date of birth,
 * gender (for division eligibility), phone and a password. The rest is added if they register
 * for a season. The client signs in right after.
 */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });
  const { name, email, dob, gender, phone, password } = parsed.data;

  const pw = accountPasswordErrors(password);
  if (pw.length) return NextResponse.json({ error: pw.join(", ") }, { status: 400 });
  const season = await getActiveSeason();
  const age = ageOn(dob, season?.startDate ?? new Date());
  if (age === null || age < 18) return NextResponse.json({ error: "Players must be 18 or older." }, { status: 400 });
  if (await blocklistHit(email)) return NextResponse.json({ error: "This email is not eligible. Contact office@nvasa.org." }, { status: 403 });
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })) {
    return NextResponse.json({ error: "That email already has an NVASA account. Log in instead." }, { status: 409 });
  }

  const [firstName, ...rest] = name.split(/\s+/);
  await prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      player: {
        create: {
          firstName,
          lastName: rest.join(" "),
          gender: GENDER[gender],
          dob: new Date(`${dob}T00:00:00Z`),
          phone,
          address: "",
          city: "",
          state: "VA",
          zip: "",
          position: "",
          tshirtSize: "",
          finalApproval: "NEEDS_REVIEW",
          status: "ACTIVE",
        },
      },
    },
  });
  return NextResponse.json({ ok: true });
}
