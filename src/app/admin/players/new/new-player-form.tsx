"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow, ChoiceGroup } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { createPlayerAccount } from "@/lib/actions/admin";

type Group = { label: string; options: { id: string; label: string; fee: number }[] };
type Gender = "FEMALE" | "MALE" | "NON_BINARY";
type Mode = "OFFLINE" | "LINK" | "WAIVED" | "LATER";
type Method = "CASH" | "CHECK" | "ZELLE" | "VENMO" | "CARD_IN_PERSON" | "OTHER";

const METHODS: [Method, string][] = [
  ["CHECK", "Check"],
  ["CASH", "Cash"],
  ["ZELLE", "Zelle"],
  ["VENMO", "Venmo"],
  ["CARD_IN_PERSON", "Card in person"],
  ["OTHER", "Other"],
];
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export function NewPlayerForm({ teams, sizes, seasonName }: { teams: Group[]; sizes: string[]; seasonName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [gender, setGender] = useState<Gender | "">("");
  const [teamId, setTeamId] = useState("");
  const [invite, setInvite] = useState(true);
  const [news, setNews] = useState(true);
  const [social, setSocial] = useState(false);
  const [tournaments, setTournaments] = useState(false);
  const [mode, setMode] = useState<Mode>("OFFLINE");
  const [method, setMethod] = useState<Method>("CHECK");
  const fee = teams.flatMap((g) => g.options).find((t) => t.id === teamId)?.fee ?? 0;

  function save(form: HTMLFormElement, override: boolean) {
    setError("");
    const f = new FormData(form);
    const str = (k: string) => String(f.get(k) ?? "").trim();
    const amt = (k: string) => {
      const v = str(k).replace(/[$,\s]/g, "");
      return v === "" ? null : Number(v);
    };
    if (!gender) return setError("Choose a gender.");
    const jersey = str("jersey");
    startTransition(async () => {
      const res = await createPlayerAccount({
        firstName: str("firstName"),
        lastName: str("lastName"),
        email: str("email"),
        dob: str("dob"),
        gender,
        phone: str("phone"),
        address: str("address"),
        city: str("city"),
        state: (str("state") || "VA") as "VA" | "MD" | "DC",
        zip: str("zip"),
        position: str("position") as "" | "GK" | "DEF" | "MID" | "FWD",
        tshirtSize: str("tshirtSize"),
        emergencyName: str("emergencyName"),
        emergencyPhone: str("emergencyPhone"),
        news,
        social,
        tournaments,
        teamId: teamId || null,
        jerseyNumber: jersey ? Number(jersey) : null,
        sendInvite: invite,
        billing: teamId
          ? {
              mode,
              amount: mode === "WAIVED" ? null : amt("amount"),
              method: mode === "OFFLINE" ? method : null,
              reference: str("reference"),
              paidOn: mode === "OFFLINE" ? str("paidOn") || null : null,
              notes: str(mode === "WAIVED" ? "reason" : "billingNotes"),
            }
          : null,
        override,
      });
      if (!res.ok) {
        // Blocklist / ZIP / age warnings: show them and let the office add the player anyway
        if (res.status === 409 && res.errors?.length) {
          setWarnings(res.errors);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        setWarnings(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return setError(res.error);
      }
      router.push(`/admin/players/${res.data?.playerId}?done=added&what=${encodeURIComponent(res.message)}`);
      router.refresh();
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWarnings(null);
    save(e.currentTarget, false);
  }

  return (
    <form id="new-player" onSubmit={submit} noValidate className="grid max-w-[920px] gap-[18px] lg:grid-cols-2 lg:items-start">
      {error || warnings ? (
        <div className="flex flex-col gap-3 lg:col-span-2">
          {error ? <Notice tone="bad">{error}</Notice> : null}
          {warnings ? (
            <Notice tone="warn" title="Check before adding this player">
              <ul className="list-disc pl-5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="primary" disabled={pending} onClick={() => save(document.getElementById("new-player") as HTMLFormElement, true)}>
                  Add anyway
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setWarnings(null)}>
                  Change details
                </Button>
              </div>
            </Notice>
          ) : null}
        </div>
      ) : null}

      <Card className="flex flex-col gap-4">
        <h3 className="text-[19px] font-bold">Player</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="np-first">
            <TextInput id="np-first" name="firstName" required autoComplete="off" />
          </Field>
          <Field label="Last name" htmlFor="np-last">
            <TextInput id="np-last" name="lastName" required autoComplete="off" />
          </Field>
        </div>
        <Field label="Email" htmlFor="np-email" hint="Their login. Invitations and payment links go here.">
          <TextInput id="np-email" name="email" type="email" required autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="np-dob">
            <TextInput id="np-dob" name="dob" type="date" required />
          </Field>
          <Field label="Mobile" htmlFor="np-phone">
            <TextInput id="np-phone" name="phone" type="tel" required />
          </Field>
        </div>
        <Field label="Gender">
          <ChoiceGroup<Gender>
            name="Gender"
            columns={3}
            value={gender}
            onChange={setGender}
            options={[
              { value: "FEMALE", label: "Female" },
              { value: "MALE", label: "Male" },
              { value: "NON_BINARY", label: "Non-binary" },
            ]}
          />
        </Field>
        <Field label="Street address" htmlFor="np-street" hint="Optional">
          <TextInput id="np-street" name="address" autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_96px_120px]">
          <Field label="City" htmlFor="np-city" hint="Optional">
            <TextInput id="np-city" name="city" autoComplete="off" />
          </Field>
          <Field label="State" htmlFor="np-state">
            <SelectInput id="np-state" name="state" defaultValue="VA">
              <option value="VA">VA</option>
              <option value="MD">MD</option>
              <option value="DC">DC</option>
            </SelectInput>
          </Field>
          <Field label="ZIP code" htmlFor="np-zip">
            <TextInput id="np-zip" name="zip" inputMode="numeric" maxLength={5} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Position" htmlFor="np-pos" hint="Optional">
            <SelectInput id="np-pos" name="position" defaultValue="">
              <option value="">Not set</option>
              <option value="GK">Goalkeeper</option>
              <option value="DEF">Defender</option>
              <option value="MID">Midfielder</option>
              <option value="FWD">Forward</option>
            </SelectInput>
          </Field>
          <Field label="T-shirt size" htmlFor="np-shirt" hint="Optional">
            <SelectInput id="np-shirt" name="tshirtSize" defaultValue="">
              <option value="">Not set</option>
              {sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Emergency contact" htmlFor="np-ename" hint="Optional">
            <TextInput id="np-ename" name="emergencyName" autoComplete="off" />
          </Field>
          <Field label="Emergency phone" htmlFor="np-ephone" hint="Optional">
            <TextInput id="np-ephone" name="emergencyPhone" type="tel" />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-bold">Opt-ins</span>
          <CheckRow checked={news} onChange={setNews} title="League news by email" />
          <CheckRow checked={social} onChange={setSocial} title="OK to appear on social media" />
          <CheckRow checked={tournaments} onChange={setTournaments} title="Interested in tournaments" />
        </div>
      </Card>

      <div className="flex flex-col gap-[18px]">
        <Card className="flex flex-col gap-4">
          <h3 className="text-[19px] font-bold">Team & invitation</h3>
          <Field label="Team" htmlFor="np-team" hint={`Optional. Choosing one creates an approved ${seasonName} registration.`}>
            <SelectInput id="np-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">No team yet</option>
              {teams.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectInput>
          </Field>
          {teamId ? (
            <Field label="Jersey number" htmlFor="np-jersey" hint="Optional">
              <TextInput id="np-jersey" name="jersey" inputMode="numeric" maxLength={2} className="max-w-[120px]" />
            </Field>
          ) : null}
          <CheckRow checked={invite} onChange={setInvite} title="Email an invitation" sub="A link to choose their password, valid for 7 days" />
        </Card>

        {teamId ? (
          <Card className="flex flex-col gap-4">
            <h3 className="text-[19px] font-bold">Billing</h3>
            <p className="-mt-2 text-[13.5px] text-muted">Division fee {money(fee)}</p>
            <ChoiceGroup<Mode>
              name="Billing"
              columns={2}
              value={mode}
              onChange={setMode}
              options={[
                { value: "OFFLINE", label: "Paid offline", sub: "Cash, check, Zelle…" },
                { value: "LINK", label: "Send payment link", sub: "They pay by card" },
                { value: "WAIVED", label: "Waived", sub: "Comp the fee" },
                { value: "LATER", label: "Collect later", sub: "Shows as unpaid" },
              ]}
            />
            {mode === "OFFLINE" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Amount paid" htmlFor="np-amount" hint="Partial payments are fine">
                    <TextInput key={`paid-${teamId}`} id="np-amount" name="amount" inputMode="decimal" defaultValue={String(fee)} />
                  </Field>
                  <Field label="Date paid" htmlFor="np-paidon">
                    <TextInput id="np-paidon" name="paidOn" type="date" defaultValue={today()} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Method" htmlFor="np-method">
                    <SelectInput id="np-method" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                      {METHODS.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label={method === "CHECK" ? "Check number" : "Reference"} htmlFor="np-ref" hint="Optional">
                    <TextInput id="np-ref" name="reference" autoComplete="off" />
                  </Field>
                </div>
                <Field label="Notes" htmlFor="np-bnotes" hint="Optional">
                  <TextInput id="np-bnotes" name="billingNotes" />
                </Field>
              </>
            ) : null}
            {mode === "LINK" || mode === "LATER" ? (
              <Field label="Amount due" htmlFor="np-due" hint={mode === "LINK" ? "Emailed as a card payment link after saving" : "Shows as unpaid until it’s recorded"}>
                <TextInput key={`due-${teamId}`} id="np-due" name="amount" inputMode="decimal" defaultValue={String(fee)} className="max-w-[160px]" />
              </Field>
            ) : null}
            {mode === "WAIVED" ? (
              <Field label="Reason" htmlFor="np-reason" hint="Required">
                <TextInput id="np-reason" name="reason" />
              </Field>
            ) : null}
          </Card>
        ) : null}

        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? "Adding…" : "Add player"}
        </Button>
      </div>
    </form>
  );
}
