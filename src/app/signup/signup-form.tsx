"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { checkSignupSlug, signUp } from "@/platform/signup";

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export function SignupForm({ domain }: { domain: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  // The check for the slug it was made for (a stale answer is ignored)
  const [checked, setChecked] = useState<{ slug: string; ok: boolean; text: string } | null>(null);
  const avail = slug && checked?.slug === slug ? checked : null;

  useEffect(() => {
    if (!slug) return;
    const t = setTimeout(() => checkSignupSlug(slug).then((r) => setChecked(r.ok ? { slug, ok: true, text: "Available" } : { slug, ok: false, text: r.reason })), 300);
    return () => clearTimeout(t);
  }, [slug]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      setError("");
      const r = await signUp({ leagueName: name, slug, email: String(f.get("email") ?? ""), password: String(f.get("password") ?? ""), website: String(f.get("website") ?? "") });
      if (!r.ok) return setError(r.error);
      window.location.href = r.url;
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Card className="flex flex-col gap-4">
        <Field label="League name" htmlFor="su-name">
          <TextInput
            id="su-name"
            value={name}
            autoComplete="organization"
            onChange={(e) => {
              setName(e.target.value);
              if (!touched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Your league’s address" htmlFor="su-slug" hint={avail ? avail.text : "Letters, numbers and dashes"}>
          <div className="flex items-center gap-1.5">
            <TextInput
              id="su-slug"
              value={slug}
              onChange={(e) => {
                setTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              aria-invalid={avail ? !avail.ok : undefined}
            />
            <span className="whitespace-nowrap text-sm text-muted">.{domain}</span>
          </div>
        </Field>
        <Field label="Your email" htmlFor="su-email">
          <TextInput id="su-email" name="email" type="email" autoComplete="email" />
        </Field>
        <Field label="Password" htmlFor="su-password" hint="10+ characters with upper and lower case and a number. Already have an account? Use its password.">
          <TextInput id="su-password" name="password" type="password" autoComplete="new-password" />
        </Field>
        {/* People never see this; bots fill it in */}
        <div aria-hidden className="hidden">
          <label htmlFor="su-website">Website</label>
          <input id="su-website" name="website" tabIndex={-1} autoComplete="off" />
        </div>
      </Card>
      <Button type="submit" variant="primary" disabled={pending || !avail?.ok || name.trim().length < 2}>
        {pending ? "Creating your league…" : "Create my league"}
      </Button>
      <p className="text-center text-[12.5px] text-muted">30-day free trial. No card needed.</p>
    </form>
  );
}
