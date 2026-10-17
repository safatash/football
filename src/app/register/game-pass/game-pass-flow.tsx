"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, GamePassTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckBox, Segmented } from "@/components/ui/controls";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Stepper } from "@/components/ui/stepper";
import { MatchMeta, VsRow } from "@/components/league";
import { ActionBar, AppBar, Screen } from "@/components/shell/layout";
import { GAME_PASS_FEE, MATCHES, ageOn, division, match as matchById, money, team } from "@/lib/league-data";
import { PassTicket } from "./ticket";

export type IdentifyMode = "login" | "find" | "new";

const STEP_LABELS = ["Who’s playing", "Match", "Pay"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<"email" | "password" | "dob" | "name" | "phone" | "match" | "form", string>>;

export function GamePassFlow({ initialMode }: { initialMode: IdentifyMode }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<IdentifyMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState("");
  const [matchId, setMatchId] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, checkout]);

  useEffect(() => {
    if (!checkout || !matchId) return;
    const t = setTimeout(() => {
      const q = new URLSearchParams({ match: String(matchId) });
      if (holder) q.set("name", holder);
      router.push(`/register/game-pass/confirmation?${q.toString()}`);
    }, 2200);
    return () => clearTimeout(t);
  }, [checkout, matchId, holder, router]);

  const upcoming = MATCHES.filter((m) => m.status === "Scheduled");
  const dates = [...new Set(upcoming.map((m) => m.date))];
  const m = matchId ? matchById(matchId) : undefined;

  function clear(k: keyof Errors) {
    setErrors((p) => (p[k] || p.form ? { ...p, [k]: undefined, form: undefined } : p));
  }

  async function identify() {
    const e: Errors = {};
    if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address.";
    if (mode === "login" && !password) e.password = "Enter your password.";
    if (mode !== "login") {
      const age = ageOn(dob);
      if (!dob || age === null) e.dob = "Enter your date of birth.";
      else if (age < 18) e.dob = "Players must be 18 or older.";
    }
    if (mode === "new") {
      if (name.trim().split(/\s+/).length < 2) e.name = "Enter your first and last name.";
      if (phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit mobile number.";
    }
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      if (mode === "login") {
        const r = await signIn("credentials", { email: email.trim(), password, redirect: false });
        if (!r || r.error) {
          setErrors({ form: "That email and password don’t match our records." });
          return;
        }
        const s = await getSession();
        setHolder(s?.user?.name ?? email.trim());
      } else if (mode === "find") {
        const res = await fetch("/api/retrieve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, dob }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!data.found) {
          setErrors({ form: "No profile matches those details. Check for a typo, or continue as a new player." });
          return;
        }
        setHolder(`${data.firstName} ${data.lastInitial}.`);
      } else {
        setHolder(name.trim());
      }
      setStep(2);
    } catch (err) {
      setErrors({ form: err instanceof Error && err.message ? err.message : "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function toReview() {
    if (!matchId) {
      setErrors({ match: "Pick a match to continue." });
      return;
    }
    setStep(3);
  }

  const back = step === 1 ? undefined : () => setStep(step - 1);

  /* ---------- Checkout handoff ---------- */
  if (checkout && m) {
    return (
      <>
        <AppBar title="Checkout" />
        <Screen className="items-center justify-center gap-5 !pt-20 text-center">
          <div className="size-[72px] animate-spin rounded-full border-[5px] border-surface-3 border-t-pitch-2" aria-hidden />
          <div className="flex flex-col gap-1.5" role="status">
            <h2 ref={headingRef} tabIndex={-1} className="text-[30px] outline-none">
              Taking you to secure checkout
            </h2>
            <p className="text-muted">Payments are processed by Stripe. NVASA never sees your card number.</p>
          </div>
          <Card className="w-full text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13.5px] text-muted">Game pass · Game #{m.id}</span>
              <b>{money(GAME_PASS_FEE)}</b>
            </div>
          </Card>
          <Button variant="ghost" size="sm" onClick={() => setCheckout(false)}>
            Cancel
          </Button>
        </Screen>
      </>
    );
  }

  const head = (title: string, sub?: ReactNode) => (
    <>
      <Stepper current={step} total={3} label={STEP_LABELS[step - 1]} />
      <div className="flex flex-col gap-1.5">
        <h1 ref={headingRef} tabIndex={-1} className="text-[34px] outline-none lg:text-[42px]">
          {title}
        </h1>
        {sub ? <p className="text-muted">{sub}</p> : null}
      </div>
    </>
  );

  return (
    <>
      <AppBar backHref={back ? undefined : "/register"} right={<GamePassTag>{money(GAME_PASS_FEE)}</GamePassTag>} title={back ? undefined : "Game pass"}>
        {back ? (
          <>
            <button type="button" aria-label="Back" onClick={back} className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface">
              <Icon name="left" />
            </button>
            <div className="min-w-0 flex-1 truncate font-display text-[21px] font-extrabold">Game pass</div>
          </>
        ) : undefined}
      </AppBar>

      <Screen>
        {/* 1 · Identify */}
        {step === 1 ? (
          <>
            {head("First, who’s playing?", "A game pass covers one match. It doesn’t put you on a team for the season.")}
            <Segmented
              label="How do you want to continue?"
              active={mode}
              onChange={(k) => {
                setMode(k as IdentifyMode);
                setErrors({});
              }}
              items={[
                { key: "login", label: "Log in" },
                { key: "find", label: "Find my info" },
                { key: "new", label: "New player" },
              ]}
            />
            <form
              className="flex flex-col gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                identify();
              }}
            >
              {errors.form ? <Notice tone="bad">{errors.form}</Notice> : null}

              {mode === "new" ? (
                <Field label="Full name" htmlFor="gn" error={errors.name}>
                  <TextInput id="gn" autoComplete="name" value={name} onChange={(e) => { setName(e.target.value); clear("name"); }} aria-invalid={errors.name ? true : undefined} />
                </Field>
              ) : null}

              <Field label={mode === "find" ? "Email you registered with" : "Email"} htmlFor="ge" error={errors.email}>
                <TextInput id="ge" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); clear("email"); }} aria-invalid={errors.email ? true : undefined} />
              </Field>

              {mode === "login" ? (
                <Field label="Password" htmlFor="gpw" error={errors.password}>
                  <TextInput
                    id="gpw"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clear("password"); }}
                    aria-invalid={errors.password ? true : undefined}
                  />
                </Field>
              ) : null}

              {mode === "find" ? (
                <>
                  <Field label="Date of birth" htmlFor="gfd" error={errors.dob}>
                    <TextInput id="gfd" type="date" autoComplete="bday" value={dob} onChange={(e) => { setDob(e.target.value); clear("dob"); }} aria-invalid={errors.dob ? true : undefined} />
                  </Field>
                  <p className="text-[13.5px] text-muted">We’ll match you to your past seasons so your pass shows up in your history.</p>
                </>
              ) : null}

              {mode === "new" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Date of birth" htmlFor="gnd" error={errors.dob}>
                      <TextInput id="gnd" type="date" autoComplete="bday" value={dob} onChange={(e) => { setDob(e.target.value); clear("dob"); }} aria-invalid={errors.dob ? true : undefined} />
                    </Field>
                    <Field label="Mobile" htmlFor="gnp" error={errors.phone}>
                      <TextInput id="gnp" type="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); clear("phone"); }} aria-invalid={errors.phone ? true : undefined} />
                    </Field>
                  </div>
                  <p className="text-[13.5px] text-muted">That’s all we need for one match. You can add the rest later if you register for a season.</p>
                </>
              ) : null}
              <button type="submit" className="sr-only" tabIndex={-1}>
                Continue
              </button>
            </form>
          </>
        ) : null}

        {/* 2 · Match */}
        {step === 2 ? (
          <>
            {head("Pick one match", "Your pass is good for this game only, on its game day.")}
            {errors.match ? <Notice tone="bad">{errors.match}</Notice> : null}
            <div role="radiogroup" aria-label="Match" className="flex flex-col gap-5">
              {dates.map((date) => (
                <div key={date} className="flex flex-col gap-2.5">
                  <span className="eyebrow">{date}</span>
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    {upcoming
                      .filter((x) => x.date === date)
                      .map((x) => {
                        const on = matchId === x.id;
                        return (
                          <button
                            key={x.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => {
                              setMatchId(x.id);
                              clear("match");
                            }}
                            className={`flex flex-col gap-2.5 rounded-[var(--radius-card)] border-[1.5px] bg-surface p-3.5 text-left transition ${
                              on ? "border-pitch-2 shadow-[inset_0_0_0_1px_var(--pitch-2)]" : "border-line hover:border-line-strong"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[13px] text-muted">Game #{x.id}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-muted">{division(x.div).name}</span>
                                <CheckBox checked={on} round />
                              </span>
                            </div>
                            <VsRow home={{ name: team(x.home).name, color: team(x.home).color, shortName: team(x.home).ab }} away={{ name: team(x.away).name, color: team(x.away).color, shortName: team(x.away).ab }} />
                            <MatchMeta date={x.date} time={x.time} field={x.field} />
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* 3 · Review & pay */}
        {step === 3 && m ? (
          <>
            {head(`One match. ${money(GAME_PASS_FEE)}.`)}
            <Notice tone="pass" icon="ticket" title="This match only." className="!text-[14.5px]">
              Valid {m.date} for Game #{m.id}. It expires when the match ends and doesn’t add you to {team(m.home).name}’s season roster.
            </Notice>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
              <PassTicket match={m} holder={holder} state={<Badge>Not paid</Badge>} />
              <Card className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span>Game pass · single match</span>
                  <b>{money(GAME_PASS_FEE)}.00</b>
                </div>
                <div className="text-[13.5px] text-muted">Discount codes don’t apply to game passes</div>
                <hr className="border-line" />
                <div className="flex items-center justify-between">
                  <b>Total</b>
                  <span className="font-display text-[30px] leading-none font-extrabold">{money(GAME_PASS_FEE)}</span>
                </div>
              </Card>
            </div>
            <Button variant="link" className="self-start text-[13.5px]" onClick={() => setStep(2)}>
              Change match
            </Button>
          </>
        ) : null}
      </Screen>

      <ActionBar>
        {step === 1 ? (
          <Button variant="primary" onClick={identify} disabled={busy}>
            {busy ? "Checking…" : "Continue to match selection"} <Icon name="right" className="size-[18px]" />
          </Button>
        ) : null}
        {step === 2 ? (
          <Button variant="primary" onClick={toReview}>
            {matchId ? `Review Game #${matchId}` : "Choose a match"} <Icon name="right" className="size-[18px]" />
          </Button>
        ) : null}
        {step === 3 ? (
          <Button variant="accent" onClick={() => setCheckout(true)}>
            <Icon name="lock" className="size-[18px]" />
            Pay {money(GAME_PASS_FEE)} securely
          </Button>
        ) : null}
      </ActionBar>
    </>
  );
}
