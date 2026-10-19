"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { createField, createPark, deleteField, deletePark, updateField, updatePark } from "@/lib/actions/fields";
import { DeleteButton } from "../../_components/structure-forms";

export type ParkValues = { id?: string; name: string; address: string; city: string; state: "VA" | "MD" | "DC"; zip: string; mapUrl: string; notes: string };
export type FieldValues = { id?: string; parkId: string; name: string; surface: "GRASS" | "TURF"; lights: boolean; size: "FULL" | "SMALL_SIDED"; active: boolean; notes: string };

const LIST = "/admin/settings/fields";
const blankField = (): Omit<FieldValues, "parkId"> => ({ name: "", surface: "GRASS", lights: false, size: "FULL", active: true, notes: "" });
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Name, surface, lights, size, status and notes for one field. */
function FieldFields({ value, onChange, idPrefix }: { value: Omit<FieldValues, "parkId">; onChange: (v: Omit<FieldValues, "parkId">) => void; idPrefix: string }) {
  const set = <K extends keyof FieldValues>(k: K, v: FieldValues[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Field name or number" htmlFor={`${idPrefix}-name`}>
          <TextInput id={`${idPrefix}-name`} value={value.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Surface" htmlFor={`${idPrefix}-surface`}>
          <SelectInput id={`${idPrefix}-surface`} value={value.surface} onChange={(e) => set("surface", e.target.value as FieldValues["surface"])}>
            <option value="GRASS">Grass</option>
            <option value="TURF">Turf</option>
          </SelectInput>
        </Field>
        <Field label="Size" htmlFor={`${idPrefix}-size`}>
          <SelectInput id={`${idPrefix}-size`} value={value.size} onChange={(e) => set("size", e.target.value as FieldValues["size"])}>
            <option value="FULL">Full size</option>
            <option value="SMALL_SIDED">Small-sided</option>
          </SelectInput>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CheckRow checked={value.lights} onChange={(v) => set("lights", v)} title="Lights" sub="Can be used after dark" />
        <CheckRow checked={value.active} onChange={(v) => set("active", v)} title="Active" sub="Inactive fields are hidden when scheduling" />
      </div>
      <Field label="Notes" htmlFor={`${idPrefix}-notes`} hint="Optional, for the office">
        <TextInput id={`${idPrefix}-notes`} value={value.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}

/** New park (with its first fields) or edit a park's details. */
export function ParkForm({ park }: { park?: ParkValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [fields, setFields] = useState([blankField()]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = {
      name: str(f, "name"),
      address: str(f, "address"),
      city: str(f, "city"),
      state: (str(f, "state") || "VA") as ParkValues["state"],
      zip: str(f, "zip"),
      mapUrl: str(f, "mapUrl"),
      notes: str(f, "notes"),
    };
    start(async () => {
      setError("");
      const res = park?.id ? await updatePark({ ...values, id: park.id }) : await createPark({ ...values, fields });
      if (!res.ok) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return setError(res.error);
      }
      router.push(`${LIST}?done=${park?.id ? "park-saved" : "park-created"}&what=${encodeURIComponent(values.name)}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[760px] flex-col gap-4">
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Park</h2>
        <Field label="Park or complex name" htmlFor="p-name" hint="e.g. Baron Cameron Park">
          <TextInput id="p-name" name="name" defaultValue={park?.name} required />
        </Field>
        <Field label="Street address" htmlFor="p-address">
          <TextInput id="p-address" name="address" defaultValue={park?.address} autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_100px_130px]">
          <Field label="City" htmlFor="p-city">
            <TextInput id="p-city" name="city" defaultValue={park?.city} />
          </Field>
          <Field label="State" htmlFor="p-state">
            <SelectInput id="p-state" name="state" defaultValue={park?.state ?? "VA"}>
              <option value="VA">VA</option>
              <option value="MD">MD</option>
              <option value="DC">DC</option>
            </SelectInput>
          </Field>
          <Field label="ZIP" htmlFor="p-zip">
            <TextInput id="p-zip" name="zip" inputMode="numeric" maxLength={5} defaultValue={park?.zip} />
          </Field>
        </div>
        <Field label="Map link" htmlFor="p-map" hint="Optional. Without one, players get Google Maps directions to the address.">
          <TextInput id="p-map" name="mapUrl" type="url" defaultValue={park?.mapUrl} />
        </Field>
        <Field label="Parking and directions" htmlFor="p-notes" hint="Optional. Shown to players on match pages.">
          <TextInput id="p-notes" name="notes" defaultValue={park?.notes} />
        </Field>
      </Card>

      {park?.id ? null : (
        <Card className="flex flex-col gap-4">
          <h2 className="text-xl">Fields</h2>
          {fields.map((fv, i) => (
            <div key={i} className="flex flex-col gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <b>Field {i + 1}</b>
                {fields.length > 1 ? (
                  <Button size="sm" variant="ghost" onClick={() => setFields(fields.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                ) : null}
              </div>
              <FieldFields idPrefix={`nf-${i}`} value={fv} onChange={(v) => setFields(fields.map((x, j) => (j === i ? v : x)))} />
            </div>
          ))}
          <div>
            <Button size="sm" variant="ghost" onClick={() => setFields([...fields, { ...blankField(), name: String(fields.length + 1) }])}>
              <Icon name="plus" className="size-4" />
              Add another field
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : park?.id ? "Save park" : "Create park"}
        </Button>
        <ButtonLink href={LIST} variant="ghost">
          Cancel
        </ButtonLink>
        <span className="flex-1" />
        {park?.id ? (
          <DeleteButton
            label="Delete park"
            title={`Delete ${park.name}?`}
            body="This removes the park and its fields. It can’t be undone. Parks whose fields have matches can’t be deleted; set the fields to inactive instead."
            action={() => deletePark({ id: park.id! })}
            doneHref={`${LIST}?done=park-deleted&what=${encodeURIComponent(park.name)}`}
          />
        ) : null}
      </div>
    </form>
  );
}

/** Add a field to a park, or edit one. */
export function FieldForm({ field, parks }: { field: FieldValues; parks: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [parkId, setParkId] = useState(field.parkId);
  const [value, setValue] = useState<Omit<FieldValues, "parkId">>(field);
  const parkName = parks.find((p) => p.id === parkId)?.name ?? "";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      setError("");
      const res = field.id ? await updateField({ ...value, id: field.id, parkId }) : await createField({ ...value, parkId });
      if (!res.ok) return setError(res.error);
      const what = `${parkName} ${/^\d+$/.test(value.name) ? `Field ${value.name}` : value.name}`;
      router.push(`${LIST}?done=${field.id ? "field-saved" : "field-created"}&what=${encodeURIComponent(what)}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[760px] flex-col gap-4">
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Card className="flex flex-col gap-4">
        <Field label="Park" htmlFor="f-park">
          <SelectInput id="f-park" value={parkId} onChange={(e) => setParkId(e.target.value)}>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <FieldFields idPrefix="f" value={value} onChange={setValue} />
      </Card>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : field.id ? "Save field" : "Add field"}
        </Button>
        <ButtonLink href={LIST} variant="ghost">
          Cancel
        </ButtonLink>
        <span className="flex-1" />
        {field.id ? (
          <DeleteButton
            label="Delete field"
            title="Delete this field?"
            body="It can’t be undone. Fields that have matches can’t be deleted; set them to inactive instead so past matches keep their location."
            action={() => deleteField({ id: field.id! })}
            doneHref={`${LIST}?done=field-deleted&what=${encodeURIComponent(`${parkName} ${/^\d+$/.test(field.name) ? `Field ${field.name}` : field.name}`)}`}
          />
        ) : null}
      </div>
    </form>
  );
}

