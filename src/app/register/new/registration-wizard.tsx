"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow, ChoiceGroup, Switch, Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Stepper } from "@/components/ui/stepper";
import { ActionBar, AppBar, Screen } from "@/components/shell/layout";
import {
  TEAMS,
  ageOn,
  discountFor,
  division,
  eligibleDivisions,
  looksEligibleZip,
  money,
  type DivisionId,
  type Gender,
} from "@/lib/league-data";

const STEPS = ["Account", "Player details", "Contact", "Playing background", "Team preferences", "Captain & updates", "Fees & review"];
const SHIRTS = ["Youth S", "Youth M", "Youth L", "Adult XS", "Adult S", "Adult M", "Adult L", "Adult XL", "Adult 2XL", "Adult 3XL"];
const NON_BINARY_MSG = "Non-binary registration is handled by the league office — email office@nvasa.org";

type Pos = "GK" | "DEF" | "MID" | "FWD";
type Form = {
  first: string;
  last: string;
  email: string;
  pw: string;
  dob: string;
  gender: Gender | "";
  div: DivisionId | "";
  pos: Pos | "";
  shirt: string;
  phone: string;
  street: string;
  city: string;
  state: "VA" | "MD" | "DC";
  zip: string;
  background: "New" | "Returning" | "";
  level: "Not sure" | "Beginner" | "Intermediate" | "Competitive" | "";
  pref: string;
  backup: string;
  captain: boolean;
  capNote: string;
  optNews: boolean;
  optSocial: boolean;
  optTourney: boolean;
  code: string;
  codeApplied: string;
  agree: boolean;
};

const EMPTY: Form = {
  first: "",
  last: "",
  email: "",
  pw: "",
  dob: "",
  gender: "",
  div: "",
  pos: "",
  shirt: "",
  phone: "",
  street: "",
  city: "",
  state: "VA",
  zip: "",
  background: "",
  level: "",
  pref: "",
  backup: "",
  captain: false,
  capNote: "",
  optNews: true,
  optSocial: false,
  optTourney: false,
  code: "",
  codeApplied: "",
  agree: false,
};

const LEVEL_LABEL: Record<string, string> = {
  "Not sure": "Not sure",
  Beginner: "Beginner / social",
  Intermediate: "Intermediate",
  Competitive: "Competitive",
};

type Errors = Partial<Record<keyof Form, string>>;

function passwordProblems(pw: string) {
  const out: string[] = [];
  if (pw.length < 10) out.push("10 or more characters");
  if (!/[A-Z]/.test(pw)) out.push("an uppercase letter");
  if (!/[a-z]/.test(pw)) out.push("a lowercase letter");
  if (!/[0-9]/.test(pw)) out.push("a number");
  return out;
}

function validate(step: number, f: Form): Errors {
  const e: Errors = {};
  if (step === 1) {
    if (!f.first.trim()) e.first = "Enter your first name.";
    if (!f.last.trim()) e.last = "Enter your last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
    const p = passwordProblems(f.pw);
    if (p.length) e.pw = `Password needs ${p.join(", ")}.`;
  }
  if (step === 2) {
    const age = ageOn(f.dob);
    if (!f.dob || age === null) e.dob = "Enter your date of birth.";
    else if (age < 18) e.dob = "Players must be 18 or older on opening day, March 29, 2026.";
    if (!f.gender) e.gender = "Choose one.";
    else if (f.gender === "Non-binary") e.gender = NON_BINARY_MSG;
    if (!e.dob && !e.gender && !f.div) e.div = "Choose a division you’re eligible for.";
    if (!f.pos) e.pos = "Choose a position.";
    if (!f.shirt) e.shirt = "Choose a size.";
  }
  if (step === 3) {
    if (f.phone.replace(/\D/g, "").length < 10) e.phone = "Enter a 10-digit phone number.";
    if (!f.street.trim()) e.street = "Enter your street address.";
    if (!f.city.trim()) e.city = "Enter your city.";
    if (!/^\d{5}$/.test(f.zip.trim())) e.zip = "Enter a 5-digit ZIP code.";
  }
  if (step === 4) {
    if (!f.background) e.background = "Choose one.";
    if (!f.level) e.level = "Choose your level.";
  }
  if (step === 5) {
    if (f.backup && f.backup === f.pref) e.backup = "Pick a different team than your first choice.";
  }
  if (step === 7) {
    if (!f.agree) e.agree = "You need to agree to the waiver to play.";
  }
  return e;
}

export function RegistrationWizard() {
  const [step, setStep] = useState(1);
  const [f, setF] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [codeErr, setCodeErr] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [fromReview, setFromReview] = useState(false);
  const [toast, showToast] = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [step, checkout]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));
  };

  // Eligibility: keep the chosen division valid as DOB / gender change.
  const elig = useMemo(() => (f.dob ? eligibleDivisions(f.dob, f.gender) : null), [f.dob, f.gender]);
  const okDivs = useMemo(() => elig?.filter((d) => d.ok) ?? [], [elig]);
  function updateEligibility(next: Partial<Form>) {
    setF((prev) => {
      const merged = { ...prev, ...next };
      const el = merged.dob ? eligibleDivisions(merged.dob, merged.gender) : null;
      const ok = el?.filter((d) => d.ok) ?? [];
      const div = ok.find((d) => d.id === merged.div) ? merged.div : (ok[0]?.id ?? "");
      const teamsOk = (id: string) => !id || TEAMS.find((t) => t.id === id)?.div === div;
      return { ...merged, div, pref: teamsOk(merged.pref) ? merged.pref : "", backup: teamsOk(merged.backup) ? merged.backup : "" };
    });
    setErrors((prev) => ({ ...prev, dob: undefined, gender: undefined, div: undefined }));
  }

  const d = f.div ? division(f.div) : null;
  const fee = d?.fee ?? 0;
  const discount = f.codeApplied ? discountFor(f.codeApplied, fee).amount : 0;
  const total = Math.max(0, fee - discount);
  const divTeams = TEAMS.filter((t) => t.div === f.div);
  const teamName = (id: string) => TEAMS.find((t) => t.id === id)?.name ?? "";

  function goTo(n: number) {
    setErrors({});
    setSubmitError("");
    if (n === 7) setFromReview(false);
    setStep(n);
  }

  function edit(n: number) {
    goTo(n);
    setFromReview(true);
  }

  function next() {
    const e = validate(step, f);
    if (Object.values(e).some(Boolean)) {
      setErrors(e);
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true], [data-error=true]")?.focus());
      return;
    }
    goTo(fromReview ? 7 : step + 1);
  }

  function applyCode() {
    const r = discountFor(f.code, fee);
    if (r.ok) {
      setF((p) => ({ ...p, codeApplied: p.code.trim().toUpperCase() }));
      setCodeErr("");
      showToast("Code applied");
    } else {
      setF((p) => ({ ...p, codeApplied: "" }));
      setCodeErr(r.message ?? "That code isn’t valid.");
    }
  }

  async function pay() {
    const e = validate(7, f);
    if (e.agree) {
      setErrors(e);
      return;
    }
    // Catch anything missed in earlier steps before handing off.
    for (let s = 1; s <= 6; s++) {
      const se = validate(s, f);
      if (Object.values(se).some(Boolean)) {
        setStep(s);
        setErrors(se);
        return;
      }
    }
    setSubmitError("");
    setCheckout(true);
    try {
      const res = await fetch("/api/register/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: f.first.trim(),
          lastName: f.last.trim(),
          email: f.email.trim(),
          password: f.pw,
          phone: f.phone.trim(),
          dob: f.dob,
          gender: f.gender,
          address: f.street.trim(),
          city: f.city.trim(),
          state: f.state,
          zip: f.zip.trim(),
          position: f.pos,
          tshirtSize: f.shirt,
          contactMe: f.optNews,
          social: f.optSocial,
          tournaments: f.optTourney,
          divisionCode: f.div,
          divisionName: d?.name,
          fee,
          preferredTeam: teamName(f.pref),
          backupTeam: teamName(f.backup),
          background: f.background,
          level: f.level,
          captainRequest: f.captain,
          captainNote: f.captain ? f.capNote.trim() : "",
          discountCode: f.codeApplied,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) throw new Error(data.error || "We couldn’t start checkout. Please try again.");
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      setCheckout(false);
      setSubmitError(err instanceof Error ? err.message : "We couldn’t start checkout. Please try again.");
    }
  }

  /* ---------- Checkout handoff ---------- */
  if (checkout) {
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
              <span className="text-[13.5px] text-muted">Spring 2026 · {d?.name}</span>
              <b>{money(total)}</b>
            </div>
          </Card>
        </Screen>
      </>
    );
  }

  const head = (title: string, sub?: ReactNode) => (
    <>
      <Stepper current={step} total={7} label={STEPS[step - 1]} />
      <div className="flex flex-col gap-1.5">
        <h1 ref={headingRef} tabIndex={-1} className="text-[34px] outline-none lg:text-[42px]">
          {title}
        </h1>
        {sub ? <p className="text-muted">{sub}</p> : null}
      </div>
    </>
  );

  const err = (k: keyof Form) => errors[k];
  const inv = (k: keyof Form) => (errors[k] ? true : undefined);

  return (
    <>
      <AppBar
        title="Season registration"
        backHref={step === 1 ? "/register" : undefined}
      >
        {step > 1 ? (
          <>
            <button
              type="button"
              aria-label="Back"
              onClick={() => goTo(step - 1)}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface"
            >
              <Icon name="left" />
            </button>
            <div className="min-w-0 flex-1 truncate font-display text-[21px] font-extrabold">Season registration</div>
          </>
        ) : undefined}
      </AppBar>

      <Screen>
        {/* 1 · Account */}
        {step === 1 ? (
          <>
            {head("Create your account", "You’ll use this to check your status, see your team and buy game passes.")}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="fn" error={err("first")}>
                <TextInput id="fn" autoComplete="given-name" value={f.first} onChange={(e) => set("first", e.target.value)} aria-invalid={inv("first")} />
              </Field>
              <Field label="Last name" htmlFor="ln" error={err("last")}>
                <TextInput id="ln" autoComplete="family-name" value={f.last} onChange={(e) => set("last", e.target.value)} aria-invalid={inv("last")} />
              </Field>
            </div>
            <Field label="Email" htmlFor="em" error={err("email")}>
              <TextInput id="em" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} aria-invalid={inv("email")} />
            </Field>
            <Field label="Password" htmlFor="pw" error={err("pw")} hint="Use 10 or more characters, with upper and lowercase letters and a number.">
              <TextInput
                id="pw"
                type="password"
                autoComplete="new-password"
                placeholder="At least 10 characters"
                value={f.pw}
                onChange={(e) => set("pw", e.target.value)}
                aria-invalid={inv("pw")}
              />
            </Field>
            <p className="text-[13.5px] text-muted">
              Played with us before?{" "}
              <Link href="/retrieve" className="font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
                Find your old profile
              </Link>{" "}
              so your history carries over.
            </p>
          </>
        ) : null}

        {/* 2 · Player details */}
        {step === 2 ? (
          <>
            {head("About you", "Your date of birth decides which divisions you can play in.")}
            <Field label="Date of birth" htmlFor="dob" error={err("dob")}>
              <TextInput id="dob" type="date" autoComplete="bday" value={f.dob} onChange={(e) => updateEligibility({ dob: e.target.value })} aria-invalid={inv("dob")} />
            </Field>
            <Field label="Gender" error={f.gender === "Non-binary" ? undefined : err("gender")}>
              <div data-error={err("gender") ? true : undefined} tabIndex={err("gender") ? -1 : undefined}>
                <ChoiceGroup<Gender>
                  name="Gender"
                  columns={3}
                  value={f.gender}
                  onChange={(v) => updateEligibility({ gender: v })}
                  options={[
                    { value: "Female", label: "Female" },
                    { value: "Male", label: "Male" },
                    { value: "Non-binary", label: "Non-binary" },
                  ]}
                />
              </div>
            </Field>
            {f.gender === "Non-binary" ? (
              <Notice tone="bad" title="Registration for non-binary players goes through the league office.">
                Email{" "}
                <a href="mailto:office@nvasa.org" className="font-bold underline">
                  office@nvasa.org
                </a>{" "}
                and we’ll get you set up in the right division.
              </Notice>
            ) : null}

            {elig ? (
              <Card className="flex flex-col gap-3">
                <div aria-live="polite" className="flex items-center justify-between gap-3">
                  <b>You can play in</b>
                  <span className="text-[13.5px] text-muted">Age {ageOn(f.dob)} on opening day</span>
                </div>
                <div role="radiogroup" aria-label="Division" className="flex flex-col gap-1" data-error={err("div") ? true : undefined} tabIndex={err("div") ? -1 : undefined}>
                  {elig.map((x) => {
                    const on = f.div === x.id;
                    return (
                      <button
                        key={x.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={!x.ok}
                        onClick={() => set("div", x.id)}
                        className={`flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left disabled:cursor-default ${
                          on ? "bg-pitch-tint shadow-[inset_0_0_0_1.5px_var(--pitch-2)]" : x.ok ? "hover:bg-surface-2" : ""
                        }`}
                      >
                        <Icon name={x.ok ? "check" : "x"} className={`size-[18px] shrink-0 ${x.ok ? "text-ok" : "text-faint"}`} />
                        <span className={`min-w-0 flex-1 ${x.ok ? "" : "text-faint"}`}>
                          <b>{x.name}</b> <span className="text-[13px] text-muted">{x.ok ? x.age : x.why || x.age}</span>
                        </span>
                        <b className={x.ok ? "" : "text-faint"}>{money(x.fee)}</b>
                      </button>
                    );
                  })}
                </div>
                {err("div") ? (
                  <span className="text-[12.5px] font-semibold text-bad">{err("div")}</span>
                ) : okDivs.length && d ? (
                  <span className="text-[12.5px] text-muted">
                    Tap a division to choose it. You picked <b>{d.name}</b>.
                  </span>
                ) : (
                  <span className="text-[12.5px] text-muted">No divisions match yet. Check your date of birth and gender.</span>
                )}
              </Card>
            ) : null}

            <Field label="Preferred position" error={err("pos")}>
              <div data-error={err("pos") ? true : undefined} tabIndex={err("pos") ? -1 : undefined}>
                <ChoiceGroup<Pos>
                  name="Preferred position"
                  columns={4}
                  value={f.pos}
                  onChange={(v) => set("pos", v)}
                  options={[
                    { value: "GK", label: "GK", sub: "Keeper" },
                    { value: "DEF", label: "DEF", sub: "Defense" },
                    { value: "MID", label: "MID", sub: "Midfield" },
                    { value: "FWD", label: "FWD", sub: "Forward" },
                  ]}
                />
              </div>
            </Field>
            <Field label="T-shirt size" htmlFor="shirt" error={err("shirt")}>
              <SelectInput id="shirt" value={f.shirt} onChange={(e) => set("shirt", e.target.value)} aria-invalid={inv("shirt")}>
                <option value="" disabled>
                  Choose a size
                </option>
                {SHIRTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SelectInput>
            </Field>
          </>
        ) : null}

        {/* 3 · Contact */}
        {step === 3 ? (
          <>
            {head("How we reach you", "Captains use your phone number for match-day changes.")}
            <Field label="Mobile phone" htmlFor="ph" error={err("phone")}>
              <TextInput id="ph" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={inv("phone")} />
            </Field>
            <Field label="Street address" htmlFor="st" error={err("street")}>
              <TextInput id="st" autoComplete="street-address" value={f.street} onChange={(e) => set("street", e.target.value)} aria-invalid={inv("street")} />
            </Field>
            <Field label="City" htmlFor="ci" error={err("city")}>
              <TextInput id="ci" autoComplete="address-level2" value={f.city} onChange={(e) => set("city", e.target.value)} aria-invalid={inv("city")} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="State" htmlFor="sta">
                <SelectInput id="sta" autoComplete="address-level1" value={f.state} onChange={(e) => set("state", e.target.value as Form["state"])}>
                  {["VA", "MD", "DC"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="ZIP code" htmlFor="zip" error={err("zip")}>
                <TextInput
                  id="zip"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  value={f.zip}
                  onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))}
                  aria-invalid={inv("zip")}
                />
              </Field>
            </div>
            <div aria-live="polite">
              {f.zip.length === 5 ? (
                looksEligibleZip(f.zip) ? (
                  <Notice tone="ok" title="You’re in our playing area.">
                    {f.zip} is an eligible ZIP code.
                  </Notice>
                ) : (
                  <Notice tone="warn" title={`${f.zip} is outside our usual area.`}>
                    You can still register. The league office will confirm you live or work in Fairfax County or an eligible ZIP.
                  </Notice>
                )
              ) : null}
            </div>
          </>
        ) : null}

        {/* 4 · Playing background */}
        {step === 4 ? (
          <>
            {head("Your soccer background", "Helps us place you on a team that plays at your level.")}
            <Field label="Have you played in NVASA before?" error={err("background")}>
              <div data-error={err("background") ? true : undefined} tabIndex={err("background") ? -1 : undefined}>
                <ChoiceGroup<"New" | "Returning">
                  name="Have you played in NVASA before?"
                  columns={2}
                  value={f.background}
                  onChange={(v) => set("background", v)}
                  options={[
                    { value: "New", label: "I’m new", sub: "First NVASA season" },
                    { value: "Returning", label: "Returning", sub: "Played a past season" },
                  ]}
                />
              </div>
            </Field>
            <Field label="Your level" error={err("level")}>
              <div data-error={err("level") ? true : undefined} tabIndex={err("level") ? -1 : undefined}>
                <ChoiceGroup<Exclude<Form["level"], "">>
                  name="Your level"
                  columns={2}
                  value={f.level}
                  onChange={(v) => set("level", v)}
                  options={[
                    { value: "Not sure", label: "Not sure", sub: "We’ll help" },
                    { value: "Beginner", label: "Beginner / social", sub: "Here for fun" },
                    { value: "Intermediate", label: "Intermediate", sub: "Played in school or rec" },
                    { value: "Competitive", label: "Competitive", sub: "College, club or semi-pro" },
                  ]}
                />
              </div>
            </Field>
          </>
        ) : null}

        {/* 5 · Team preferences */}
        {step === 5 ? (
          <>
            {head(
              "Pick your team",
              <>
                Teams in <b className="text-fg">{d?.name}</b>. Your captain still has to have room for you.
              </>,
            )}
            <Field label="Preferred team" htmlFor="pref">
              <SelectInput
                id="pref"
                value={f.pref}
                onChange={(e) => {
                  const v = e.target.value;
                  setF((p) => ({ ...p, pref: v, backup: v === "" || p.backup === v ? "" : p.backup }));
                }}
              >
                <option value="">I don’t have a team yet</option>
                {divTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.size} players)
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Backup team" htmlFor="bk" error={err("backup")} hint="If your first choice is full, we’ll try this one.">
              <SelectInput id="bk" value={f.backup} disabled={!f.pref} onChange={(e) => set("backup", e.target.value)} aria-invalid={inv("backup")}>
                <option value="">No backup</option>
                {divTeams
                  .filter((t) => t.id !== f.pref)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.size} players)
                    </option>
                  ))}
              </SelectInput>
            </Field>
            {!f.pref ? (
              <Notice tone="info" icon="users" title="No team? No problem.">
                You’ll go to our placement list. The league office looks at your level and position, then places you on a team with open spots,
                usually within 5 days.
              </Notice>
            ) : null}
          </>
        ) : null}

        {/* 6 · Captain & updates */}
        {step === 6 ? (
          <>
            {head("Want to captain?", "Optional. Captains manage the roster, lineup and match reports.")}
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <b>Request captain access</b>
                  <div className="text-[13.5px] text-muted">For {f.pref ? teamName(f.pref) : "the team you’re placed on"}</div>
                </div>
                <Switch checked={f.captain} onChange={(v) => set("captain", v)} label="Request captain access" />
              </div>
              {f.captain ? (
                <>
                  <Field label="Tell the league office why" htmlFor="cn">
                    <TextArea id="cn" placeholder="e.g. I organized the team last season" value={f.capNote} onChange={(e) => set("capNote", e.target.value)} />
                  </Field>
                  <Notice tone="warn" icon="clock">
                    This is a request. The league office reviews it with your registration. You’ll register as a player until it’s approved.
                  </Notice>
                </>
              ) : null}
            </Card>
            <div className="flex flex-col gap-1">
              <h3 className="text-[22px]">Stay in the loop</h3>
              <CheckRow checked={f.optNews} onChange={(v) => set("optNews", v)} title="NVASA news" sub="Schedules, field closures and season announcements" />
              <CheckRow checked={f.optSocial} onChange={(v) => set("optSocial", v)} title="Social media posts" sub="OK to appear in match photos we share" />
              <CheckRow checked={f.optTourney} onChange={(v) => set("optTourney", v)} title="Tournament interest" sub="Tell me about summer and fall tournaments" />
            </div>
          </>
        ) : null}

        {/* 7 · Fees & review */}
        {step === 7 && d ? (
          <>
            {head("Review and pay", "Check your details. You can edit anything before paying.")}
            {submitError ? <Notice tone="bad">{submitError}</Notice> : null}
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
              <Card className="flex flex-col gap-3 lg:sticky lg:top-[140px] lg:order-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="eyebrow">Spring 2026 fee</span>
                  <Badge tone="info" dot={false}>
                    {d.name}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Division fee</span>
                  <b>{money(fee)}</b>
                </div>
                {f.codeApplied ? (
                  <div className="flex items-center justify-between text-ok">
                    <span>Code {f.codeApplied}</span>
                    <b>−{money(discount)}</b>
                  </div>
                ) : null}
                <hr className="border-line" />
                <div className="flex items-center justify-between">
                  <b className="text-[17px]">Total due</b>
                  <span className="font-display text-[34px] leading-none font-extrabold">{money(total)}</span>
                </div>
                <Field label="Discount code" htmlFor="code" error={codeErr || undefined}>
                  <div className="flex gap-2">
                    <TextInput
                      id="code"
                      className="uppercase"
                      placeholder="Board, promo or team code"
                      value={f.code}
                      onChange={(e) => {
                        set("code", e.target.value);
                        setCodeErr("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyCode();
                        }
                      }}
                      aria-invalid={codeErr ? true : undefined}
                    />
                    <Button variant="ghost" className="min-h-12" onClick={applyCode}>
                      Apply
                    </Button>
                  </div>
                </Field>
              </Card>

              <div className="flex flex-col gap-3 lg:order-1">
                <Summary title="Account" onEdit={() => edit(1)} rows={[["Name", `${f.first} ${f.last}`], ["Email", f.email]]} />
                <Summary
                  title="Player"
                  onEdit={() => edit(2)}
                  rows={[
                    ["Born", f.dob ? new Date(`${f.dob}T12:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"],
                    ["Gender", f.gender],
                    ["Position", f.pos],
                    ["Shirt", f.shirt],
                    ["Division", d.name],
                  ]}
                />
                <Summary title="Contact" onEdit={() => edit(3)} rows={[["Phone", f.phone], ["Address", `${f.street}, ${f.city}, ${f.state} ${f.zip}`]]} />
                <Summary title="Background" onEdit={() => edit(4)} rows={[["NVASA", f.background], ["Level", LEVEL_LABEL[f.level] ?? f.level]]} />
                <Summary
                  title="Team"
                  onEdit={() => edit(5)}
                  rows={[["Preferred", f.pref ? teamName(f.pref) : "Placement by league office"], ["Backup", f.backup ? teamName(f.backup) : "—"]]}
                />
                <Summary
                  title="Captain & updates"
                  onEdit={() => edit(6)}
                  rows={[
                    ["Captain request", f.captain ? "Yes, pending review" : "No"],
                    ["Updates", [f.optNews && "News", f.optSocial && "Social", f.optTourney && "Tournaments"].filter(Boolean).join(", ") || "None"],
                  ]}
                />
              </div>
            </div>
            <div data-error={err("agree") ? true : undefined} tabIndex={err("agree") ? -1 : undefined} className="flex flex-col">
              <CheckRow checked={f.agree} onChange={(v) => set("agree", v)} title="I agree to the NVASA player waiver and code of conduct" sub="Required to play" />
              {err("agree") ? <span className="pl-[34px] text-[12.5px] font-semibold text-bad">{err("agree")}</span> : null}
            </div>
            <p className="text-xs text-muted">
              {total === 0
                ? "Nothing to pay. Your registration goes straight to the league office for review."
                : "You’ll finish payment on our secure checkout page. Your registration goes to the league office for review after payment."}
            </p>
          </>
        ) : null}
      </Screen>

      <ActionBar>
        {step > 1 ? (
          <Button variant="ghost" className="!flex-none" onClick={() => goTo(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < 7 ? (
          <Button variant="primary" onClick={next}>
            {fromReview ? "Back to review" : "Continue"} <Icon name="right" className="size-[18px]" />
          </Button>
        ) : (
          <Button variant="accent" onClick={pay}>
            <Icon name="lock" className="size-[18px]" />
            {total === 0 ? "Submit registration" : `Pay ${money(total)} securely`}
          </Button>
        )}
      </ActionBar>
      <Toast message={toast} />
    </>
  );
}

function Summary({ title, onEdit, rows }: { title: string; onEdit: () => void; rows: [string, ReactNode][] }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <b>{title}</b>
        <Button variant="link" className="text-[13.5px]" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
          Edit
        </Button>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 text-[13.5px]">
          <span className="shrink-0 text-muted">{k}</span>
          <span className="min-w-0 text-right font-semibold break-words">{v || "—"}</span>
        </div>
      ))}
    </Card>
  );
}
