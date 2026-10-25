"use client";

import { useBrand } from "@/components/brand";
import { signOut } from "next-auth/react";
import { startTransition, useActionState, useEffect, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow, Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ActionBar } from "@/components/shell/layout";
import { updateProfile, type ProfileState } from "./actions";

export type ProfileValues = {
  firstName: string;
  lastName: string;
  dob: string;
  position: string;
  tshirtSize: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  contactMe: boolean;
  social: boolean;
  tournaments: boolean;
};

const POSITIONS = [
  ["GK", "Goalkeeper"],
  ["DEF", "Defender"],
  ["MID", "Midfielder"],
  ["FWD", "Forward"],
];
const SIZES = ["Adult XS", "Adult S", "Adult M", "Adult L", "Adult XL", "Adult XXL"];

const withCurrent = (list: string[], v: string) => (v && !list.includes(v) ? [v, ...list] : list);

export function ProfileForm({ values }: { values: ProfileValues }) {
  const brand = useBrand();
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, null);
  const [toast, showToast] = useToast();
  const [prefs, setPrefs] = useState({ contactMe: values.contactMe, social: values.social, tournaments: values.tournaments });

  useEffect(() => {
    if (state?.ok) showToast(state.message);
  }, [state, showToast]);

  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);
  const input = (name: keyof ProfileValues, label: string, props: Partial<ComponentProps<"input">> = {}) => (
    <Field label={label} htmlFor={`pf-${name}`} error={err(name)}>
      <TextInput id={`pf-${name}`} name={name} defaultValue={String(values[name])} aria-invalid={!!err(name) || undefined} {...props} />
    </Field>
  );

  return (
    <form
      id="profile-form"
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        // Submit manually so fields keep what the player typed when validation fails.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {state && !state.ok ? <Notice tone="bad">{state.error}</Notice> : null}

      <Card className="flex flex-col gap-4">
        <h3 className="text-[19px] font-bold">Personal details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("firstName", "First name", { autoComplete: "given-name", required: true })}
          {input("lastName", "Last name", { autoComplete: "family-name", required: true })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="pf-dob" hint="Contact the league office to change">
            <TextInput id="pf-dob" type="date" value={values.dob} disabled readOnly />
          </Field>
          <Field label="Position" htmlFor="pf-position" error={err("position")}>
            <SelectInput id="pf-position" name="position" defaultValue={values.position}>
              {withCurrent(
                POSITIONS.map(([v]) => v),
                values.position,
              ).map((v) => (
                <option key={v} value={v}>
                  {POSITIONS.find(([p]) => p === v)?.[1] ?? v}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="T-shirt size" htmlFor="pf-tshirtSize" error={err("tshirtSize")}>
          <SelectInput id="pf-tshirtSize" name="tshirtSize" defaultValue={values.tshirtSize}>
            {withCurrent(SIZES, values.tshirtSize).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectInput>
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h3 className="text-[19px] font-bold">Contact</h3>
        <Field label="Email" htmlFor="pf-email" hint="Contact the league office to change">
          <TextInput id="pf-email" type="email" value={values.email} disabled readOnly />
        </Field>
        {input("phone", "Mobile", { type: "tel", autoComplete: "tel", inputMode: "tel", required: true })}
        {input("address", "Street address", { autoComplete: "street-address", required: true })}
        <div className="grid grid-cols-[minmax(0,1fr)_80px_110px] gap-3">
          {input("city", "City", { autoComplete: "address-level2", required: true })}
          {input("state", "State", { autoComplete: "address-level1", maxLength: 2, required: true })}
          {input("zip", "ZIP", { autoComplete: "postal-code", inputMode: "numeric", required: true })}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h3 className="text-[19px] font-bold">Emergency contact</h3>
        {input("emergencyContactName", "Contact name", { autoComplete: "off", required: true })}
        {input("emergencyContactPhone", "Contact phone", { type: "tel", autoComplete: "off", inputMode: "tel", required: true })}
      </Card>

      <Card className="flex flex-col gap-1">
        <h3 className="mb-1 text-[19px] font-bold">Preferences</h3>
        <CheckRow checked={prefs.contactMe} onChange={(v) => setPrefs((p) => ({ ...p, contactMe: v }))} title={`${brand.name} news`} sub="Season dates, registration openings and league updates by email" />
        <CheckRow checked={prefs.social} onChange={(v) => setPrefs((p) => ({ ...p, social: v }))} title="Social media posts" sub={`Photos of you may appear on ${brand.name}’s social accounts`} />
        <CheckRow checked={prefs.tournaments} onChange={(v) => setPrefs((p) => ({ ...p, tournaments: v }))} title="Tournament interest" sub="Hear about tournaments and select teams" />
        {prefs.contactMe ? <input type="hidden" name="contactMe" value="on" /> : null}
        {prefs.social ? <input type="hidden" name="social" value="on" /> : null}
        {prefs.tournaments ? <input type="hidden" name="tournaments" value="on" /> : null}
      </Card>

      <ActionBar withTabs className="!px-0 lg:pb-0">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </ActionBar>
      <Toast message={toast} />
    </form>
  );
}

export function LogoutButton() {
  return (
    <Button variant="ghost" block onClick={() => signOut({ callbackUrl: "/" })}>
      <Icon name="out" className="size-4" />
      Log out
    </Button>
  );
}
