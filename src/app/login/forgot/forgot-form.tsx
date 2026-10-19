"use client";

import { useBrand } from "@/components/brand";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Screen } from "@/components/shell/layout";

export function ForgotForm() {
  const brand = useBrand();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    setLoading(true);
    try {
      const res = await fetch("/api/account/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError("We couldn’t send the link right now. Try again in a minute.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] lg:text-[42px]">Reset your password</h1>
        <p className="text-muted">Enter the email on your {brand.name} account. We’ll send a link to choose a new password.</p>
      </div>
      {sent ? (
        <>
          <Notice tone="ok" title="Check your email.">
            If {email.trim()} has an account here, a reset link is on its way. It works once and expires in 30 minutes.
          </Notice>
          <ButtonLink href="/login" variant="ghost">
            Back to log in
          </ButtonLink>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Field label="Email" htmlFor="fe">
            <TextInput id="fe" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" block disabled={loading}>
            {loading ? "Sending…" : "Email me a reset link"}
          </Button>
        </form>
      )}
    </Screen>
  );
}
