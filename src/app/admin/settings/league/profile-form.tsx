"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow } from "@/components/ui/controls";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { removeLeagueLogo, updateLeagueProfile, uploadLeagueLogo } from "@/lib/actions/league-profile";

type Values = {
  name: string;
  fullName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  contactEmail: string;
  supportEmail: string;
  timezone: string;
  waiverText: string;
  registrationOpen: boolean;
  waiverRequired: boolean;
  logoUrl: string;
  facebookUrl: string;
  twitterUrl: string;
  instagramUrl: string;
};

/** A color swatch plus the hex value (empty keeps the app's default). */
function ColorField({ id, label, hint, value, fallback, onChange, disabled }: { id: string; label: string; hint: string; value: string; fallback: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value || fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          disabled={disabled}
          className="size-11 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
        />
        <TextInput id={id} value={value} placeholder={`Default (${fallback})`} onChange={(e) => onChange(e.target.value.trim())} maxLength={7} disabled={disabled} />
        {value ? (
          <Button size="sm" variant="ghost" onClick={() => onChange("")} disabled={disabled}>
            Reset
          </Button>
        ) : null}
      </div>
    </Field>
  );
}

export function LeagueProfileForm({ values, timezones, blobReady, readOnly, url }: { values: Values; timezones: string[]; blobReady: boolean; readOnly: boolean; url: string }) {
  const router = useRouter();
  const [v, setV] = useState(values);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Values>(k: K, x: Values[K]) => setV((p) => ({ ...p, [k]: x }));

  function done(res: { ok: true; message: string } | { ok: false; error: string }) {
    if (!res.ok) {
      setSaved("");
      setError(res.error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
    setError("");
    setSaved(res.message);
    router.refresh();
    return true;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      done(await updateLeagueProfile(v));
    });
  }

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.set("logo", file);
    start(async () => {
      const res = await uploadLeagueLogo(form);
      if (done(res) && res.ok && res.data) set("logoUrl", res.data.url);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function removeLogo() {
    start(async () => {
      if (done(await removeLeagueLogo())) set("logoUrl", "");
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[760px] flex-col gap-4">
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {saved ? <Notice tone="ok">{saved}</Notice> : null}
      {readOnly ? <Notice tone="info">Staff can view the league profile. An owner or admin can change it.</Notice> : null}

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Name</h2>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <Field label="Short name" htmlFor="lp-name" hint="In the header, page titles and emails">
            <TextInput id="lp-name" value={v.name} onChange={(e) => set("name", e.target.value)} required disabled={readOnly} />
          </Field>
          <Field label="Full name" htmlFor="lp-full" hint="Optional, e.g. Northern Virginia Adult Soccer">
            <TextInput id="lp-full" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} disabled={readOnly} />
          </Field>
        </div>
        <Field label="Tagline" htmlFor="lp-tagline" hint="One or two sentences for the home page and search results">
          <TextArea id="lp-tagline" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={300} disabled={readOnly} />
        </Field>
        <p className="text-[13px] text-muted">
          Your league’s address: <b className="text-fg">{url}</b>
        </p>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Logo and colors</h2>
        <div className="flex flex-wrap items-center gap-4">
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded logo preview
            <img src={v.logoUrl} alt="Current logo" className="size-16 rounded-xl border border-line bg-surface object-contain" />
          ) : (
            <span className="grid size-16 place-items-center rounded-xl border border-dashed border-line-strong text-[12px] text-muted">No logo</span>
          )}
          {readOnly ? null : (
            <div className="flex flex-col gap-1.5">
              {blobReady ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Logo file" className="text-sm" onChange={upload} disabled={pending} />
                </div>
              ) : (
                <p className="text-[13px] text-muted">Uploads aren’t set up on this server yet. Paste a link to your logo below.</p>
              )}
              <span className="text-[12.5px] text-muted">PNG, JPEG or WebP, up to 512 KB. Square works best.</span>
              {v.logoUrl ? (
                <div>
                  <Button size="sm" variant="ghost" onClick={removeLogo} disabled={pending}>
                    Remove logo
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
        {blobReady ? null : (
          <Field label="Logo link" htmlFor="lp-logo" hint="An https:// link to an image">
            <TextInput id="lp-logo" type="url" value={v.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} disabled={readOnly} />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField id="lp-primary" label="Main color" hint="Header, buttons and links" value={v.primaryColor} fallback="#0F3D2E" onChange={(x) => set("primaryColor", x)} disabled={readOnly} />
          <ColorField id="lp-accent" label="Accent color" hint="Highlights and call-to-action buttons" value={v.accentColor} fallback="#C8F04A" onChange={(x) => set("accentColor", x)} disabled={readOnly} />
        </div>
        <p className="text-[13px] text-muted">Dark main colors are kept dark enough for white text, so headers stay readable.</p>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Contacts</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="lp-contact" hint="Replies to league emails go here">
            <TextInput id="lp-contact" type="email" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Support email" htmlFor="lp-support" hint="Optional. Shown to players who need help; defaults to the contact email">
            <TextInput id="lp-support" type="email" value={v.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} disabled={readOnly} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Facebook" htmlFor="lp-fb">
            <TextInput id="lp-fb" type="url" placeholder="https://" value={v.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="X (Twitter)" htmlFor="lp-x">
            <TextInput id="lp-x" type="url" placeholder="https://" value={v.twitterUrl} onChange={(e) => set("twitterUrl", e.target.value)} disabled={readOnly} />
          </Field>
          <Field label="Instagram" htmlFor="lp-ig">
            <TextInput id="lp-ig" type="url" placeholder="https://" value={v.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} disabled={readOnly} />
          </Field>
        </div>
        <Field label="Timezone" htmlFor="lp-tz" hint="Saved for your league. Pages still show Eastern time for now.">
          <SelectInput id="lp-tz" value={v.timezone} onChange={(e) => set("timezone", e.target.value)} disabled={readOnly}>
            {timezones.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </SelectInput>
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Registration and waiver</h2>
        <div className="flex flex-col gap-1">
          <CheckRow
            checked={v.registrationOpen}
            onChange={(on) => !readOnly && set("registrationOpen", on)}
            title="Season registration is open"
            sub="Turn off to close registration for every season. Each season can also set opening and closing dates."
          />
          <CheckRow
            checked={v.waiverRequired}
            onChange={(on) => !readOnly && set("waiverRequired", on)}
            title="Players must accept the waiver"
            sub="Registration records when each player accepted it"
          />
        </div>
        <Field label="Waiver and code of conduct" htmlFor="lp-waiver" hint="Players read and agree to this when they register">
          <TextArea id="lp-waiver" value={v.waiverText} onChange={(e) => set("waiverText", e.target.value)} className="min-h-[220px]" disabled={readOnly} />
        </Field>
      </Card>

      {readOnly ? null : (
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save league profile"}
          </Button>
        </div>
      )}
    </form>
  );
}
