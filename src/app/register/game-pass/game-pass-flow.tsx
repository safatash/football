"use client";

import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge, GamePassTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckBox, ChoiceGroup, Segmented } from "@/components/ui/controls";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Stepper } from "@/components/ui/stepper";
import { MatchMeta, VsRow } from "@/components/league";
import { ActionBar, AppBar, Screen } from "@/components/shell/layout";
import { ageOn } from "@/lib/eligibility";
import { money } from "@/lib/format";
import { PassTicket } from "./ticket";

export type IdentifyMode = "login" | "find" | "new";
type FlowTeam = { id: string; name: string; color: string | null; shortName: string | null };
export type FlowMatch = { id: string; gameNumber: number; date: string; time: string; field: string | null; division: string; /** Set when the division overrides the league game-pass fee. */ fee?: number; homeTeam: FlowTeam; awayTeam: FlowTeam };
type Gender = "Female" | "Male" | "Non-binary";

const STEP_LABELS = ["Who’s playing", "Match", "Pay"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<"email" | "password" | "dob" | "name" | "phone" | "gender" | "match" | "form", string>>;
const todayIso = () => new Date().toISOString().slice(0, 10);

export function GamePassFlow({
  initialMode,
  matches,
  fee,
  signedIn,
}: {
  initialMode: IdentifyMode;
  matches: FlowMatch[];
  fee: number;
  /** Signed-in players skip "Who's playing". */
  signedIn: { name: string } | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(signedIn ? 2 : 1);
  const [gender, setGender] = useState<Gender | "">("");
  const [teamId, setTeamId] = useState<string>("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<IdentifyMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState(signedIn?.name ?? "");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const price = matches.find((m) => m.id === matchId)?.fee ?? fee;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, checkout]);

  const upcoming = matches;
  const dates = [...new Set(upcoming.map((m) => m.date))];
  const m = matchId ? matches.find((x) => x.id === matchId) : undefined;
  const ticketTeam = m && teamId ? (teamId === m.homeTeam.id ? m.homeTeam.name : m.awayTeam.name) : null;

  async function pay() {
    if (!m) return;
    setCheckout(true);
    setErrors({});
    try {
      const res = await fetch("/api/game-pass/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: m.id, teamId: teamId || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "We couldn’t start checkout. Please try again.");
      if (data.url.startsWith("/")) router.push(data.url);
      else window.location.assign(data.url);
    } catch (err) {
      setCheckout(false);
      setErrors({ form: err instanceof Error ? err.message : "We couldn’t start checkout. Please try again." });
    }
  }

  function clear(k: keyof Errors) {
    setErrors((p) => (p[k] || p.form ? { ...p, [k]: undefined, form: undefined } : p));
  }

  async function identify() {
    const e: Errors = {};
    if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address.";
    if (mode === "login" && !password) e.password = "Enter your password.";
    if (mode !== "login") {
      const age = dob ? ageOn(dob, todayIso()) : null;
      if (!dob || age === null) e.dob = "Enter your date of birth.";
      else if (age < 18) e.dob = "Players must be 18 or older.";
    }
    if (mode === "new") {
      if (name.trim().split(/\s+/).length < 2) e.name = "Enter your first and last name.";
      if (phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit mobile number.";
      if (!gender) e.gender = "Choose one.";
      if (password.length < 10) e.password = "Use 10 or more characters, with upper and lowercase letters and a number.";
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
        if (!s?.user?.playerId) {
          setErrors({ form: "This account doesn’t have a player profile yet. Continue as a new player with another email, or register for a season." });
          return;
        }
        setHolder(s.user.name ?? email.trim());
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
        // Found: they still need to sign in to buy a pass on that profile.
        setMode("login");
        setNotice(`We found your profile, ${data.firstName}. Log in to buy your pass.`);
        return;
      } else {
        const res = await fetch("/api/game-pass/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), dob, gender, phone: phone.trim(), password }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error);
        const r = await signIn("credentials", { email: email.trim(), password, redirect: false });
        if (!r || r.error) throw new Error("Your profile is ready, but we couldn’t sign you in. Log in to continue.");
        setHolder(name.trim());
      }
      router.refresh();
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

  const back = step === 1 || (step === 2 && signedIn) ? undefined : () => setStep(step - 1);

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
              <span className="text-[13.5px] text-muted">Game pass · Game #{m.gameNumber}</span>
              <b>{money(price)}</b>
            </div>
          </Card>
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
      <AppBar backHref={back ? undefined : "/register"} right={<GamePassTag>{money(price)}</GamePassTag>} title={back ? undefined : "Game pass"}>
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
              {errors.form ? <Notice tone="bad">{errors.form}</Notice> : notice ? <Notice tone="ok">{notice}</Notice> : null}

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
                  <Field label="Gender" error={errors.gender}>
                    <ChoiceGroup<Gender>
                      name="Gender"
                      columns={3}
                      value={gender}
                      onChange={(v) => {
                        setGender(v);
                        clear("gender");
                      }}
                      options={[
                        { value: "Female", label: "Female" },
                        { value: "Male", label: "Male" },
                        { value: "Non-binary", label: "Non-binary" },
                      ]}
                    />
                  </Field>
                  <Field label="Password" htmlFor="gnpw" error={errors.password} hint="Use 10 or more characters, with upper and lowercase letters and a number.">
                    <TextInput
                      id="gnpw"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); clear("password"); }}
                      aria-invalid={errors.password ? true : undefined}
                    />
                  </Field>
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
            {upcoming.length ? null : <Notice tone="info">No matches are open for game passes right now. Check back when the next match day is scheduled.</Notice>}
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
                              if (x.id !== matchId) setTeamId("");
                              setMatchId(x.id);
                              clear("match");
                            }}
                            className={`flex flex-col gap-2.5 rounded-[var(--radius-card)] border-[1.5px] bg-surface p-3.5 text-left transition ${
                              on ? "border-pitch-2 shadow-[inset_0_0_0_1px_var(--pitch-2)]" : "border-line hover:border-line-strong"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[13px] text-muted">Game #{x.gameNumber}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-muted">
                                  {x.division}
                                  {x.fee != null && x.fee !== fee ? ` · ${money(x.fee)}` : ""}
                                </span>
                                <CheckBox checked={on} round />
                              </span>
                            </div>
                            <VsRow home={x.homeTeam} away={x.awayTeam} />
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
            {head(`One match. ${money(price)}.`)}
            {errors.form ? <Notice tone="bad">{errors.form}</Notice> : null}
            <Notice tone="pass" icon="ticket" title="This match only." className="!text-[14.5px]">
              Valid {m.date} for Game #{m.gameNumber}. It expires when the match ends and doesn’t add you to {ticketTeam ?? "a team"}’s season roster.
            </Notice>
            <Field label="Playing for">
              <ChoiceGroup<string>
                name="Playing for"
                value={teamId || "none"}
                onChange={(v) => setTeamId(v === "none" ? "" : v)}
                options={[
                  { value: m.homeTeam.id, label: m.homeTeam.name },
                  { value: m.awayTeam.id, label: m.awayTeam.name },
                  { value: "none", label: "Not sure yet", sub: "The captain or league office adds you" },
                ]}
              />
            </Field>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
              <PassTicket match={m} holder={holder} teamName={ticketTeam} state={<Badge>Not paid</Badge>} />
              <Card className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span>Game pass · single match</span>
                  <b>{money(price)}</b>
                </div>
                <div className="text-[13.5px] text-muted">Discount codes don’t apply to game passes</div>
                <hr className="border-line" />
                <div className="flex items-center justify-between">
                  <b>Total</b>
                  <span className="font-display text-[30px] leading-none font-extrabold">{money(price)}</span>
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
            {m ? `Review Game #${m.gameNumber}` : "Choose a match"} <Icon name="right" className="size-[18px]" />
          </Button>
        ) : null}
        {step === 3 ? (
          <Button variant="accent" onClick={pay}>
            <Icon name="lock" className="size-[18px]" />
            Pay {money(price)} securely
          </Button>
        ) : null}
      </ActionBar>
    </>
  );
}
