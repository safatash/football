"use server";

/**
 * /signup on the root domain: a login (new, or an existing one with its password), a league in
 * TRIAL for 30 days and an OWNER membership, then a one-time sign-in on the league's own address.
 * No subscription billing yet.
 */
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import { accountPasswordErrors } from "@/lib/password";
import { leagueOrigin } from "@/lib/tenant";
import { createToken } from "@/lib/tokens";
import { runWithOrg } from "./db";
import { createOrganization, slugAvailability } from "./organizations";
import prisma from "./prisma";

/** A few signups per address per hour (per server instance; enough to slow down scripts). */
const recent = new Map<string, number[]>();
const LIMIT = 5;
function throttled(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 3600_000);
  recent.set(ip, hits);
  if (hits.length >= LIMIT) return true;
  hits.push(now);
  return false;
}

export async function checkSignupSlug(slug: string) {
  return slugAvailability(String(slug).trim().toLowerCase());
}

const SignupInput = z.object({
  leagueName: z.string().trim().min(2, "Name your league.").max(60),
  slug: z.string().trim().toLowerCase(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Choose a password.").max(200),
  /** Hidden field people don't see; bots fill it in */
  website: z.string().max(200).optional(),
});

export async function signUp(input: z.input<typeof SignupInput>): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const parsed = SignupInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  const data = parsed.data;
  if (data.website) return { ok: false, error: "Something went wrong. Try again." };
  const h = await headers();
  if (throttled(h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local")) return { ok: false, error: "Too many signups from here. Try again in an hour." };

  const avail = await slugAvailability(data.slug);
  if (!avail.ok) return { ok: false, error: avail.reason };
  const existing = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: "insensitive" } } });
  if (existing) {
    // An existing login can start a league, but only with its own password
    if (!(await bcrypt.compare(data.password, existing.password))) return { ok: false, error: "That email already has an account. Enter its password to add a league to it." };
  } else {
    const problems = accountPasswordErrors(data.password);
    if (problems.length) return { ok: false, error: problems[0] };
  }

  try {
    const { org, owner } = await createOrganization({ name: data.leagueName, slug: data.slug, ownerEmail: data.email, ownerPassword: existing ? null : data.password });
    // Sessions are per address: sign in on the league's own site, then go to the setup checklist
    const token = await runWithOrg(org.id, () => createToken("login", owner.id, 5 * 60_000));
    return { ok: true, url: `${leagueOrigin(org)}/login/link?token=${token}&next=/admin/setup` };
  } catch (e) {
    return { ok: false, error: e instanceof Error && /taken|reserved|letters/.test(e.message) ? e.message : "We couldn’t create your league. Try again in a moment." };
  }
}
