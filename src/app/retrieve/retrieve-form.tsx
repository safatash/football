"use client";

import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/controls";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/shell/layout";

type Found = { found: true; firstName: string; lastInitial: string; maskedEmail: string; since: number; lastTeam?: string };
type Result = Found | { found: false } | null;

export function RetrieveForm() {
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, showToast] = useToast(3200);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!email.trim() || !dob) {
      setError("Enter your email and date of birth.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, dob }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "We couldn’t look that up right now.");
      setResult(data as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t look that up right now.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    document.getElementById("re")?.focus();
  }

  return (
    <Screen>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] lg:text-[42px]">Find your player profile</h1>
        <p className="text-muted">Enter the email and date of birth you registered with. We’ll match them to your past seasons.</p>
      </div>

      <form onSubmit={lookup} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="re">
          <TextInput id="re" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Date of birth" htmlFor="rd">
          <TextInput id="rd" type="date" autoComplete="bday" value={dob} onChange={(e) => setDob(e.target.value)} />
        </Field>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Button type="submit" variant="primary" block disabled={loading}>
          <Icon name="search" className="size-[18px]" />
          {loading ? "Looking…" : "Find my profile"}
        </Button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-4">
        {result?.found ? (
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border-[1.5px] border-ok bg-surface p-4">
            <div className="flex items-center gap-2">
              <Icon name="check" className="size-5 text-ok" />
              <b>We found your profile</b>
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-bold">
                {result.firstName.slice(0, 1)}
                {result.lastInitial}
              </span>
              <div className="min-w-0 flex-1">
                <b>
                  {result.firstName} {result.lastInitial}.
                </b>
                <div className="truncate text-[13.5px] text-muted">
                  {result.maskedEmail} · Player since {result.since}
                </div>
              </div>
            </div>
            {result.lastTeam ? (
              <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                <span className="text-muted">Last team:</span>
                <b>{result.lastTeam}</b>
              </div>
            ) : null}
            <Button variant="primary" block onClick={() => showToast(`Login link sent to ${result.maskedEmail}`)}>
              <Icon name="mail" className="size-[18px]" />
              Email me a login link
            </Button>
            <ButtonLink href="/login?next=/register" variant="ghost" block>
              Log in to register for Spring 2026
            </ButtonLink>
          </div>
        ) : null}

        {result && !result.found ? (
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border-[1.5px] border-warn bg-surface p-4">
            <div className="flex items-center gap-2">
              <Icon name="alert" className="size-5 text-warn" />
              <b>No profile matches those details</b>
            </div>
            <p className="text-[13.5px] text-muted">
              Check for a typo, or try another email you might have used. Players from before 2018 may need help from the league office.
            </p>
            <Button variant="ghost" block onClick={reset}>
              Try different details
            </Button>
            <ButtonLink href="/register/new" variant="primary" block>
              Register as a new player
            </ButtonLink>
            <p className="text-center text-xs text-muted">
              League office:{" "}
              <a href="mailto:office@nvasa.org" className="font-bold text-fg">
                office@nvasa.org
              </a>
            </p>
          </div>
        ) : null}
      </div>

      <Toast message={toast} />
    </Screen>
  );
}
