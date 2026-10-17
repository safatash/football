import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { DIVISIONS, discountFor } from "@/lib/league-data";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

type Payload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  position?: string;
  tshirtSize?: string;
  contactMe?: boolean;
  social?: boolean;
  tournaments?: boolean;
  divisionCode?: string;
  divisionName?: string;
  fee?: number;
  preferredTeam?: string;
  backupTeam?: string;
  background?: string;
  level?: string;
  captainRequest?: boolean;
  captainNote?: string;
  discountCode?: string;
};

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as Payload;

    const firstName = str(data.firstName);
    const lastName = str(data.lastName);
    const email = str(data.email).toLowerCase();
    const password = typeof data.password === "string" ? data.password : "";
    const zip = str(data.zip);

    // 1. Required fields
    const required: [string, string][] = [
      [firstName, "first name"],
      [lastName, "last name"],
      [email, "email"],
      [str(data.phone), "phone"],
      [str(data.dob), "date of birth"],
      [str(data.address), "street address"],
      [str(data.city), "city"],
      [str(data.state), "state"],
      [zip, "ZIP code"],
      [str(data.position), "position"],
      [str(data.tshirtSize), "T-shirt size"],
    ];
    const missing = required.filter(([v]) => !v).map(([, label]) => label);
    if (missing.length) return bad(`Please add your ${missing.join(", ")}.`);

    // 2. Gender (the database stores MALE / FEMALE only)
    const genderMap: Record<string, "MALE" | "FEMALE"> = { Female: "FEMALE", FEMALE: "FEMALE", Male: "MALE", MALE: "MALE" };
    if (data.gender === "Non-binary") {
      return bad("Non-binary registration is handled by the league office — email office@nvasa.org");
    }
    const gender = genderMap[str(data.gender)];
    if (!gender) return bad("Please choose a gender.");

    // 3. Password: 10+ characters plus the strength rules
    const strength = validatePasswordStrength(password);
    const pwErrors = [...(password.length < 10 ? ["Password must be at least 10 characters long"] : []), ...strength.errors.filter((e) => !e.includes("8 characters"))];
    if (pwErrors.length) return bad(pwErrors.join(", "));

    // 4. Division and amount are computed here, never taken from the client
    const div = DIVISIONS.find((d) => d.id === data.divisionCode);
    if (!div) return bad("Please choose a division.");
    const code = str(data.discountCode).toUpperCase();
    let discount = 0;
    if (code) {
      const d = discountFor(code, div.fee);
      if (!d.ok) return bad(d.message ?? "That discount code isn’t valid.");
      discount = d.amount;
    }
    const amount = Math.max(0, div.fee - discount);

    // 5. Duplicate email
    const existingUser = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (existingUser) return bad("That email already has an NVASA account. Log in or use Find my player info instead.");

    // 6. Blocklist
    const blocked = await prisma.blocklist.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (blocked) return bad("This email is not eligible for registration. Contact office@nvasa.org.");

    // 7. ZIP no longer blocks: flag it for the league office
    const allowedZip = await prisma.allowedZipCode.findUnique({ where: { zipCode: zip } });
    const fairfaxCounty = Boolean(allowedZip);

    // 8. Active season
    const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
    if (!activeSeason) return bad("Registration isn’t open right now. Check back soon.");

    // 9. Account + player
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        player: {
          create: {
            firstName,
            lastName,
            gender,
            dob: new Date(`${str(data.dob).slice(0, 10)}T00:00:00Z`),
            phone: str(data.phone),
            address: str(data.address),
            city: str(data.city),
            state: str(data.state),
            zip,
            fairfaxCounty,
            position: str(data.position),
            tshirtSize: str(data.tshirtSize),
            contactMe: Boolean(data.contactMe),
            social: Boolean(data.social),
            tournaments: Boolean(data.tournaments),
            boardMemberCode: code === "BOARD26" ? code : null,
            discountCode: code && code !== "BOARD26" && !code.startsWith("TEAMPAID") ? code : null,
            teamPaidFullCode: code.startsWith("TEAMPAID") ? code : null,
            finalApproval: "NEEDS_REVIEW",
            status: "ACTIVE",
          },
        },
      },
      include: { player: true },
    });

    // 10. Registration
    const preferred = str(data.preferredTeam);
    const backup = str(data.backupTeam);
    const selectedTeams = [preferred, backup].filter(Boolean);
    const registration = await prisma.registration.create({
      data: {
        playerId: user.player!.id,
        seasonId: activeSeason.id,
        registrationType: "NEW_PLAYER",
        selectedTeams: JSON.stringify(selectedTeams),
        captainRequests: data.captainRequest && preferred ? JSON.stringify([preferred]) : null,
        totalAmount: amount,
        status: "PENDING",
        paymentStatus: amount === 0 ? "PAID" : "UNPAID",
      },
    });

    // 11. Nothing to pay: done
    if (amount === 0) {
      return NextResponse.json({ success: true, checkoutUrl: `/register/success?registration=${registration.id}` });
    }

    // 12. Stripe checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `NVASA Spring 2026 · ${div.name}`,
              description: `${activeSeason.name} · ${firstName} ${lastName}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXTAUTH_URL}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/register/new`,
      client_reference_id: registration.id,
      customer_email: email,
      metadata: {
        registrationId: registration.id,
        playerId: user.player!.id,
        userId: user.id,
        division: div.name,
        discountCode: code,
      },
    });

    return NextResponse.json({ success: true, checkoutUrl: session.url });
  } catch (error) {
    console.error("Registration error:", error);
    return bad("We couldn’t finish your registration. Please try again, or email office@nvasa.org.", 500);
  }
}
