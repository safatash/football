"use server";

/**
 * Parks and fields for the league office. Every action checks admin access on the server and
 * writes an audit entry. A field with matches can't be deleted (set it inactive instead).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { audit } from "@/lib/billing";
import { fieldName } from "@/lib/public";
import { requireAdminUser } from "./admin-guard";
import { ActionError, runAction, type ActionResult } from "./result";

const Id = z.string().trim().min(1).max(64);
const opt = (max: number) => z.string().trim().max(max).optional();

const ParkInput = z.object({
  name: z.string().trim().min(2, "Name the park.").max(80),
  address: opt(120),
  city: opt(60),
  state: z.enum(["VA", "MD", "DC"]).default("VA"),
  zip: z
    .string()
    .trim()
    .refine((v) => !v || /^\d{5}$/.test(v), "Enter a 5-digit ZIP code.")
    .optional(),
  mapUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\//.test(v), "Map links start with https://")
    .optional(),
  notes: opt(500),
});

const FieldInput = z.object({
  name: z.string().trim().min(1, "Name or number the field.").max(40),
  surface: z.enum(["GRASS", "TURF"]).default("GRASS"),
  lights: z.boolean().default(false),
  size: z.enum(["FULL", "SMALL_SIDED"]).default("FULL"),
  active: z.boolean().default(true),
  notes: opt(300),
});

const parkData = (p: z.infer<typeof ParkInput>) => ({
  name: p.name,
  address: p.address || null,
  city: p.city || null,
  state: p.state,
  zip: p.zip || null,
  mapUrl: p.mapUrl || null,
  notes: p.notes || null,
});
const fieldData = (f: z.infer<typeof FieldInput>) => ({ name: f.name, surface: f.surface, lights: f.lights, size: f.size, active: f.active, notes: f.notes || null });

function refresh() {
  revalidatePath("/admin/settings/fields", "layout");
  revalidatePath("/admin/matches", "layout");
}

async function assertParkNameFree(name: string, exceptId?: string) {
  const taken = await prisma.park.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (taken) throw new ActionError(`There’s already a park called ${taken.name}.`, 409);
}

function assertUniqueNames(names: string[]) {
  const seen = new Set<string>();
  for (const n of names.map((x) => x.toLowerCase())) {
    if (seen.has(n)) throw new ActionError(`Two fields are called “${n}”. Field names must be unique within a park.`, 409);
    seen.add(n);
  }
}

async function assertFieldNameFree(parkId: string, name: string, exceptId?: string) {
  const taken = await prisma.field.findFirst({ where: { parkId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (taken) throw new ActionError(`This park already has ${fieldName(taken.name)}.`, 409);
}

/** A new park with its first fields. */
export async function createPark(input: z.input<typeof ParkInput> & { fields: z.input<typeof FieldInput>[] }): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const park = ParkInput.parse(input);
    const fields = z.array(FieldInput).min(1, "Add at least one field.").max(30).parse(input.fields);
    const admin = await requireAdminUser();
    await assertParkNameFree(park.name);
    assertUniqueNames(fields.map((f) => f.name));
    const row = await prisma.$transaction(async (tx) => {
      const p = await tx.park.create({ data: { ...parkData(park), fields: { create: fields.map(fieldData) } } });
      await audit(tx, admin, { action: "park.created", entityType: "park", entityId: p.id, summary: `Added ${p.name} with ${fields.length} field${fields.length === 1 ? "" : "s"}` });
      return p;
    });
    refresh();
    return { ok: true, message: `${row.name} added`, data: { id: row.id } };
  });
}

export async function updatePark(input: z.input<typeof ParkInput> & { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const park = ParkInput.parse(input);
    const id = Id.parse(input.id);
    const admin = await requireAdminUser();
    if (!(await prisma.park.findUnique({ where: { id } }))) throw new ActionError("Park not found.", 404);
    await assertParkNameFree(park.name, id);
    await prisma.$transaction(async (tx) => {
      await tx.park.update({ where: { id }, data: parkData(park) });
      await audit(tx, admin, { action: "park.updated", entityType: "park", entityId: id, summary: `Updated ${park.name}` });
    });
    refresh();
    return { ok: true, message: `${park.name} saved` };
  });
}

/** Deletes a park whose fields have never had a match. */
export async function deletePark(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const id = Id.parse(input.id);
    const admin = await requireAdminUser();
    const park = await prisma.park.findUnique({ where: { id }, include: { fields: { select: { id: true, _count: { select: { matches: true } } } } } });
    if (!park) throw new ActionError("Park not found.", 404);
    const used = park.fields.reduce((a, f) => a + f._count.matches, 0);
    if (used) throw new ActionError(`${park.name} has ${used} match${used === 1 ? "" : "es"} on its fields, so it can’t be deleted. Set its fields to inactive instead.`, 409);
    await prisma.$transaction(async (tx) => {
      await tx.field.deleteMany({ where: { parkId: id } });
      await tx.park.delete({ where: { id } });
      await audit(tx, admin, { action: "park.deleted", entityType: "park", entityId: id, summary: `Deleted ${park.name}` });
    });
    refresh();
    return { ok: true, message: `${park.name} deleted` };
  });
}

const QuickPark = z.object({ name: z.string().trim().min(2, "Name the park.").max(80), city: opt(60) });

/**
 * Adds a field to a park. For the match form's quick add, `newPark` creates the park too
 * (name and city only; the address can be filled in later under Settings › Fields).
 */
export async function createField(
  input: z.input<typeof FieldInput> & { parkId?: string | null; newPark?: z.input<typeof QuickPark> | null },
): Promise<ActionResult<{ id: string; parkId: string; park: string; label: string }>> {
  return runAction(async () => {
    const field = FieldInput.parse(input);
    const admin = await requireAdminUser();
    const newPark = input.newPark ? QuickPark.parse(input.newPark) : null;
    let park = !newPark && input.parkId ? await prisma.park.findUnique({ where: { id: Id.parse(input.parkId) } }) : null;
    if (!newPark && !park) throw new ActionError("Pick a park.", 400);
    if (newPark) await assertParkNameFree(newPark.name);
    else await assertFieldNameFree(park!.id, field.name);
    const row = await prisma.$transaction(async (tx) => {
      if (newPark) park = await tx.park.create({ data: { name: newPark.name, city: newPark.city || null, state: "VA" } });
      const f = await tx.field.create({ data: { ...fieldData(field), parkId: park!.id } });
      await audit(tx, admin, { action: "field.created", entityType: "field", entityId: f.id, summary: `Added ${park!.name} ${fieldName(f.name)}` });
      return f;
    });
    refresh();
    return {
      ok: true,
      message: `${park!.name} ${fieldName(row.name)} added`,
      data: { id: row.id, parkId: park!.id, park: [park!.name, park!.city].filter(Boolean).join(" · "), label: fieldName(row.name) },
    };
  });
}

export async function updateField(input: z.input<typeof FieldInput> & { id: string; parkId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const field = FieldInput.parse(input);
    const id = Id.parse(input.id);
    const parkId = Id.parse(input.parkId);
    const admin = await requireAdminUser();
    const current = await prisma.field.findUnique({ where: { id } });
    if (!current) throw new ActionError("Field not found.", 404);
    const park = await prisma.park.findUnique({ where: { id: parkId } });
    if (!park) throw new ActionError("Pick a park.", 400);
    await assertFieldNameFree(parkId, field.name, id);
    await prisma.$transaction(async (tx) => {
      await tx.field.update({ where: { id }, data: { ...fieldData(field), parkId } });
      await audit(tx, admin, {
        action: "field.updated",
        entityType: "field",
        entityId: id,
        summary: `Updated ${park.name} ${fieldName(field.name)}${current.active !== field.active ? (field.active ? " (active again)" : " (set inactive)") : ""}`,
      });
    });
    refresh();
    return { ok: true, message: `${park.name} ${fieldName(field.name)} saved` };
  });
}

/** Deletes a field that has never had a match. */
export async function deleteField(input: { id: string }): Promise<ActionResult> {
  return runAction(async () => {
    const id = Id.parse(input.id);
    const admin = await requireAdminUser();
    const field = await prisma.field.findUnique({ where: { id }, include: { park: true, _count: { select: { matches: true } } } });
    if (!field) throw new ActionError("Field not found.", 404);
    const label = `${field.park.name} ${fieldName(field.name)}`;
    if (field._count.matches) {
      throw new ActionError(`${label} has ${field._count.matches} match${field._count.matches === 1 ? "" : "es"}, so it can’t be deleted. Set it to inactive instead.`, 409);
    }
    await prisma.$transaction(async (tx) => {
      await tx.field.delete({ where: { id } });
      await audit(tx, admin, { action: "field.deleted", entityType: "field", entityId: id, summary: `Deleted ${label}` });
    });
    refresh();
    return { ok: true, message: `${label} deleted` };
  });
}
