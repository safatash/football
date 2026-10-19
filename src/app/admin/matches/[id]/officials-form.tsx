"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { setMatchOfficials } from "@/lib/actions/referees";

type Role = "CENTER" | "AR1" | "AR2" | "FOURTH";
type Status = "ASSIGNED" | "CONFIRMED" | "DECLINED" | "NO_SHOW";
export type CrewSlot = { role: Role; refereeId: string; name: string; status: Status; fee: number | null };
type RefOption = { id: string; name: string; positions: string[] };

const ROLES: [Role, string][] = [
  ["CENTER", "Center"],
  ["AR1", "AR1"],
  ["AR2", "AR2"],
  ["FOURTH", "4th official (optional)"],
];
const STATUSES: [Status, string][] = [
  ["ASSIGNED", "Assigned"],
  ["CONFIRMED", "Confirmed"],
  ["DECLINED", "Declined"],
  ["NO_SHOW", "No-show"],
];
const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** One picker per role (active referees only), with status and an optional fee override. */
export function OfficialsForm({
  matchId,
  crew: initial,
  referees,
  defaults,
  readOnly,
}: {
  matchId: string;
  crew: CrewSlot[];
  referees: RefOption[];
  /** The division's fee per role, shown when there's no override. */
  defaults: Record<Role, number | null>;
  readOnly?: boolean;
}) {
  const blank = (role: Role) => ({ role, refereeId: "", name: "", status: "ASSIGNED" as Status, fee: null as number | null });
  const [crew, setCrew] = useState(ROLES.map(([role]) => initial.find((c) => c.role === role) ?? blank(role)));
  const [feeText, setFeeText] = useState<Record<Role, string>>(() => Object.fromEntries(ROLES.map(([r]) => [r, initial.find((c) => c.role === r)?.fee?.toString() ?? ""])) as Record<Role, string>);
  const [dirty, setDirty] = useState(false);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [toast, showToast] = useToast(3500);
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = (role: Role, patch: Partial<CrewSlot>) => {
    setCrew((list) => list.map((c) => (c.role === role ? { ...c, ...patch } : c)));
    setDirty(true);
    setWarnings(null);
  };
  const open = crew.filter((c) => c.role !== "FOURTH" && (!c.refereeId || c.status === "DECLINED")).map((c) => (c.role === "CENTER" ? "Center" : c.role));

  const save = (force: boolean) =>
    start(async () => {
      setError("");
      const payload = crew.map((c) => {
        const t = feeText[c.role].replace(/[$,\s]/g, "");
        return { role: c.role, refereeId: c.refereeId || null, status: c.status, fee: t === "" ? null : Number(t) };
      });
      const res = await setMatchOfficials({ matchId, crew: payload, force });
      if (!res.ok) {
        if (res.status === 409 && res.errors?.length) return setWarnings(res.errors);
        return setError(res.error);
      }
      setWarnings(null);
      setDirty(false);
      showToast(res.message);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {open.length ? (
        <Notice tone="warn">Still open: {open.join(", ")}</Notice>
      ) : (
        <p className="text-[13px] font-semibold text-ok">Full crew assigned.</p>
      )}
      {error ? <Notice tone="bad">{error}</Notice> : null}
      {crew.map((c) => {
        const label = ROLES.find(([r]) => r === c.role)![1];
        // Active referees, plus whoever already holds the slot (even if now inactive)
        const options = referees.some((r) => r.id === c.refereeId) || !c.refereeId ? referees : [...referees, { id: c.refereeId, name: `${c.name} (inactive)`, positions: [] }];
        const taken = new Set(crew.filter((x) => x.role !== c.role && x.refereeId).map((x) => x.refereeId));
        const def = defaults[c.role];
        return (
          <div key={c.role} className="flex flex-col gap-1.5 border-b border-line pb-3 last:border-0 last:pb-0">
            <Field label={label} htmlFor={`official-${c.role}`}>
              <SelectInput
                id={`official-${c.role}`}
                className="h-[42px]"
                value={c.refereeId}
                disabled={readOnly}
                onChange={(e) => set(c.role, { refereeId: e.target.value, name: options.find((o) => o.id === e.target.value)?.name ?? "", status: "ASSIGNED" })}
              >
                <option value="">Unassigned</option>
                {options
                  .filter((r) => !taken.has(r.id))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.positions.length === 1 ? (r.positions[0] === "CENTER" ? " · center" : " · assistant") : ""}
                    </option>
                  ))}
              </SelectInput>
            </Field>
            {c.refereeId ? (
              <div className="grid grid-cols-2 gap-2">
                <SelectInput aria-label={`${label} status`} className="h-9 text-[13px]" value={c.status} disabled={readOnly} onChange={(e) => set(c.role, { status: e.target.value as Status })}>
                  {STATUSES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </SelectInput>
                <TextInput
                  aria-label={`${label} fee`}
                  className="h-9 text-[13px]"
                  inputMode="decimal"
                  placeholder={def != null ? `Fee ${money(def)}` : "Fee"}
                  value={feeText[c.role]}
                  disabled={readOnly}
                  onChange={(e) => {
                    setFeeText((f) => ({ ...f, [c.role]: e.target.value }));
                    setDirty(true);
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      {warnings ? (
        <Notice tone="warn" title="Check the referee schedule">
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" disabled={pending} onClick={() => save(true)}>
              Save anyway
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWarnings(null)}>
              Change it
            </Button>
          </div>
        </Notice>
      ) : null}
      {dirty && !readOnly && !warnings ? (
        <Button variant="primary" size="sm" disabled={pending} onClick={() => save(false)}>
          {pending ? "Saving…" : "Save officials"}
        </Button>
      ) : null}
      <Link href="/admin/referees/assignments" className="text-[13px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
        Assignments board
      </Link>
      <Toast message={toast} />
    </div>
  );
}
