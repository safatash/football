"use server";

/** Admin › Settings › League profile: the league's name, logo, colors, contacts, timezone and waiver. */
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, getOrgId } from "@/lib/db";
import { requireOrgRole } from "@/lib/access";
import { audit } from "@/lib/billing";
import { forgetOrg } from "@/platform/orgs";
import { ActionError, runAction, type ActionResult } from "./result";

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const hex = z
  .string()
  .trim()
  .regex(/^(#[0-9a-fA-F]{6})?$/, "Pick a color like #0F3D2E.")
  .optional()
  .transform((v) => (v ? v.toUpperCase() : null));
const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254).optional().or(z.literal("")).transform((v) => v || null);
const httpsUrl = (what: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || /^https:\/\/[^\s]+$/.test(v), `Use a full https:// link for ${what}.`)
    .optional()
    .transform((v) => v || null);
const timezones = new Set(Intl.supportedValuesOf("timeZone"));

const ProfileInput = z.object({
  name: z.string().trim().min(2, "Enter the league’s short name.").max(40),
  fullName: opt(100),
  tagline: opt(300),
  primaryColor: hex,
  accentColor: hex,
  contactEmail: email,
  supportEmail: email,
  timezone: z.string().refine((t) => timezones.has(t), "Pick a timezone."),
  waiverText: opt(20000),
  logoUrl: httpsUrl("the logo"),
  facebookUrl: httpsUrl("Facebook"),
  twitterUrl: httpsUrl("X (Twitter)"),
  instagramUrl: httpsUrl("Instagram"),
});
export type ProfileInputValues = z.input<typeof ProfileInput>;

function refresh() {
  forgetOrg();
  revalidatePath("/", "layout");
}

export async function updateLeagueProfile(input: ProfileInputValues): Promise<ActionResult> {
  return runAction(async () => {
    const data = ProfileInput.parse(input);
    const me = await requireOrgRole(["OWNER", "ADMIN"]);
    const orgId = await getOrgId();
    const { waiverText, ...org } = data;
    await db.$transaction(async (tx) => {
      // Organization isn't league-scoped (it is the league): always this league's own row
      await tx.organization.update({ where: { id: orgId }, data: org });
      await tx.organizationSettings.upsert({ where: { organizationId: orgId }, update: { waiverText }, create: { organizationId: orgId, waiverText } });
      await audit(tx, me, { action: "league.profile", entityType: "organization", entityId: orgId, summary: `Updated the league profile (${org.name})` });
    });
    refresh();
    return { ok: true, message: "League profile saved" };
  });
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const LOGO_MAX_BYTES = 512 * 1024;

/** Uploads a logo to Vercel Blob under orgs/<orgId>/ and makes it the league's logo. */
export async function uploadLeagueLogo(form: FormData): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const me = await requireOrgRole(["OWNER", "ADMIN"]);
    const file = form.get("logo");
    if (!(file instanceof File) || !file.size) throw new ActionError("Choose an image file.");
    const ext = LOGO_TYPES[file.type];
    if (!ext) throw new ActionError("Use a PNG, JPEG or WebP image.");
    if (file.size > LOGO_MAX_BYTES) throw new ActionError("Use an image under 512 KB.");
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new ActionError("Logo upload isn’t set up on this server yet (BLOB_READ_WRITE_TOKEN). Paste a logo link instead.", 409);
    const orgId = await getOrgId();
    const { put } = await import("@vercel/blob");
    // Uploads are prefixed with the league id so one league's files never mix with another's
    const blob = await put(`orgs/${orgId}/logo-${randomBytes(6).toString("hex")}.${ext}`, file, { access: "public", contentType: file.type });
    await db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: orgId }, data: { logoUrl: blob.url } });
      await audit(tx, me, { action: "league.logo", entityType: "organization", entityId: orgId, summary: "Uploaded a new league logo" });
    });
    refresh();
    return { ok: true, message: "Logo uploaded", data: { url: blob.url } };
  });
}

export async function removeLeagueLogo(): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireOrgRole(["OWNER", "ADMIN"]);
    const orgId = await getOrgId();
    await db.$transaction(async (tx) => {
      await tx.organization.update({ where: { id: orgId }, data: { logoUrl: null } });
      await audit(tx, me, { action: "league.logo", entityType: "organization", entityId: orgId, summary: "Removed the league logo" });
    });
    refresh();
    return { ok: true, message: "Logo removed" };
  });
}
