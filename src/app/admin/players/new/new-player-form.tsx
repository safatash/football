"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow, ChoiceGroup } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { createPlayerAccount } from "@/lib/actions/admin";

type Group = { label: string; options: { id: string; label: string }[] };
type Gender = "FEMALE" | "MALE" | "NON_BINARY";

export function NewPlayerForm({ teams }: { teams: Group[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [teamId, setTeamId] = useState("");
  const [invite, setInvite] = useState(true);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "").trim();
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
        zip: str("zip"),
        position: str("position") as "" | "GK" | "DEF" | "MID" | "FWD",
        teamId: teamId || null,
        jerseyNumber: jersey ? Number(jersey) : null,
        sendInvite: invite,
      });
      if (!res.ok) return setError(res.error);
      router.push(`/admin/players/${res.data?.playerId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-[880px] gap-[18px] lg:grid-cols-2 lg:items-start">
      <Card className="flex flex-col gap-4">
        <h3 className="text-[19px] font-bold">Player</h3>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="np-first">
            <TextInput id="np-first" name="firstName" required autoComplete="off" />
          </Field>
          <Field label="Last name" htmlFor="np-last">
            <TextInput id="np-last" name="lastName" required autoComplete="off" />
          </Field>
        </div>
        <Field label="Email" htmlFor="np-email" hint="Their login. The invitation goes here.">
          <TextInput id="np-email" name="email" type="email" required autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date of birth" htmlFor="np-dob">
            <TextInput id="np-dob" name="dob" type="date" required />
          </Field>
          <Field label="Mobile" htmlFor="np-phone" hint="Optional">
            <TextInput id="np-phone" name="phone" type="tel" />
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
          <Field label="ZIP code" htmlFor="np-zip" hint="Optional">
            <TextInput id="np-zip" name="zip" inputMode="numeric" maxLength={5} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h3 className="text-[19px] font-bold">Team & invitation</h3>
        <Field label="Team" htmlFor="np-team" hint="Optional. You can add teams later from their player page.">
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
        <Button type="submit" variant="primary" block disabled={pending}>
          {pending ? "Adding…" : "Add player"}
        </Button>
      </Card>
    </form>
  );
}
