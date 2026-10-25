"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export type ProfileState = { ok: true; message: string } | { ok: false; error: string; fieldErrors?: Record<string, string> } | null;

const req = (label: string, max = 80) => z.string().trim().min(1, `Enter your ${label}`).max(max, `${label[0].toUpperCase()}${label.slice(1)} is too long`);

const schema = z.object({
  firstName: req("first name", 50),
  lastName: req("last name", 50),
  position: z.string().trim().min(1, "Pick a position").max(20),
  tshirtSize: req("shirt size", 20),
  phone: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number"),
  address: req("street address", 120),
  city: req("city", 60),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use the 2-letter state code"),
  zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP"),
  emergencyContactName: req("emergency contact's name", 80),
  emergencyContactPhone: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number"),
  contactMe: z.boolean(),
  social: z.boolean(),
  tournaments: z.boolean(),
});

/** Updates the signed-in player's own profile. The player id always comes from the session. */
export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await getSession();
  const playerId = session?.user?.playerId;
  if (!playerId) return { ok: false, error: "Your session has expired. Log in again to save changes." };

  const str = (k: string) => String(formData.get(k) ?? "");
  const parsed = schema.safeParse({
    firstName: str("firstName"),
    lastName: str("lastName"),
    position: str("position"),
    tshirtSize: str("tshirtSize"),
    phone: str("phone"),
    address: str("address"),
    city: str("city"),
    state: str("state"),
    zip: str("zip"),
    emergencyContactName: str("emergencyContactName"),
    emergencyContactPhone: str("emergencyContactPhone"),
    contactMe: formData.get("contactMe") === "on",
    social: formData.get("social") === "on",
    tournaments: formData.get("tournaments") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      fieldErrors[k] ??= issue.message;
    }
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }

  try {
    await db.player.update({ where: { id: playerId }, data: parsed.data });
  } catch {
    return { ok: false, error: "We couldn’t save your profile. Try again in a moment." };
  }
  revalidatePath("/portal/profile");
  return { ok: true, message: "Profile saved" };
}
