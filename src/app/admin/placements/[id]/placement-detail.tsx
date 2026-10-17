"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactNode } from "react";
import { Crest, PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, KeyValue } from "@/components/ui/card";
import { Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { assignPlacement, requestPlacementInfo, waitlistPlacement } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/result";
import type { Placement, PlacementLabel, PlacementTeam } from "@/lib/queries/placements";
import { PlacementBadge } from "../placement-badge";

type DivisionOption = { id: string; name: string };

export function PlacementDetail({
  placement: p,
  divisions,
  teams: allTeams,
  readOnly,
  crumbs,
  notice,
}: {
  placement: Placement;
  divisions: DivisionOption[];
  teams: PlacementTeam[];
  readOnly: boolean;
  crumbs: ReactNode;
  notice: ReactNode;
}) {
  const first = p.name.split(" ")[0];
  const [state, setState] = useState<PlacementLabel>(p.state);
  const [div, setDiv] = useState(p.division?.id ?? divisions[0]?.id ?? "");
  const [teamId, setTeamId] = useState(p.rec?.teamId ?? "");
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState(`Hi ${first}, thanks for registering. Which Sunday time slots work best for you, and have you played 11v11 before?`);
  const [toast, showToast] = useToast();
  const closeAsk = useCallback(() => setAsking(false), []);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const run = (action: () => Promise<ActionResult>, next: PlacementLabel, after?: () => void) =>
    startTransition(async () => {
      const res = await action();
      showToast(res.ok ? res.message : res.error);
      if (!res.ok) return;
      setState(next);
      after?.();
      router.refresh();
    });

  const teams = allTeams.filter((t) => t.divisionId === div);
  const pick = teams.find((t) => t.id === teamId) ?? null;
  const rec = p.rec;
  const divisionName = (id: string | undefined) => divisions.find((d) => d.id === id)?.name ?? "—";

  return (
    <>
      <div className="flex flex-col gap-2">
        {crumbs}
        <PageHeading title={p.name} sub={`${p.number} · ${p.city} · age ${p.age ?? "unknown"}`} actions={<PlacementBadge state={state} />} />
      </div>
      {notice}

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Card>
            <CardHeader title="What they told us" />
            <KeyValue
              items={[
                ["Requested division", p.division?.name ?? "—"],
                ["Level", p.level],
                ["Position", p.pos],
              ]}
            />
            <div className="mt-3 rounded-[var(--radius-field)] bg-surface-2 p-3.5">
              <span className="eyebrow">Notes</span>
              <p className="mt-1">{p.notes ? `“${p.notes}”` : "No notes."}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Teams in ${divisionName(div)}`} action={<span className="text-[13px] text-muted">Pick one</span>} />
            <div role="radiogroup" aria-label="Team" className="flex flex-col gap-2">
              {teams.map((t) => {
                const on = pick?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={readOnly}
                    onClick={() => setTeamId(t.id)}
                    className={`flex min-h-14 items-center gap-3 rounded-[var(--radius-field)] border-[1.5px] bg-surface px-3.5 py-2.5 text-left transition disabled:cursor-not-allowed ${
                      on ? "border-pitch-2 bg-pitch-tint shadow-[inset_0_0_0_1px_var(--pitch-2)]" : "border-line-strong hover:border-pitch-2"
                    }`}
                  >
                    <Crest team={t} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="text-[14.5px]">{t.name}</b>
                      <span className="text-[12.5px] text-muted">
                        {t.size} players · {t.record}
                        {t.captain ? ` · captain ${t.captain}` : ""}
                      </span>
                    </span>
                    {t.id === rec?.teamId ? (
                      <Badge tone="ok" dot={false}>
                        Suggested
                      </Badge>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          {rec ? (
            <Card className="flex flex-col gap-3 border-ok">
              <span className="eyebrow">Suggested placement</span>
              <div className="flex items-center gap-3">
                <Crest team={rec.team} size="lg" />
                <div>
                  <h3 className="text-[20px]">{rec.team.name}</h3>
                  <div className="text-[13px] text-muted">{rec.divisionName}</div>
                </div>
              </div>
              <p className="text-sm">{rec.why}</p>
            </Card>
          ) : null}

          <Card className="flex flex-col gap-3">
            <Field label="Division" htmlFor="placement-division">
              <SelectInput id="placement-division" value={div} disabled={readOnly} onChange={(e) => setDiv(e.target.value)}>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Button
              variant="primary"
              block
              disabled={readOnly || !pick || pending}
              onClick={() => pick && run(() => assignPlacement({ registrationId: p.id, teamId: pick.id }), "Assigned")}
            >
              <Icon name="check" className="size-4" />
              Assign to {pick ? pick.name : "a team"}
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                variant="ghost"
                disabled={readOnly || pending}
                onClick={() => run(() => waitlistPlacement({ registrationId: p.id }), "Waitlisted")}
              >
                <Icon name="wait" className="size-4" />
                Waitlist
              </Button>
              <Button variant="ghost" disabled={readOnly || pending} onClick={() => setAsking(true)}>
                <Icon name="mail" className="size-4" />
                Request info
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <Dialog
        open={asking}
        onClose={closeAsk}
        title={`Ask ${first} for more info`}
        actions={
          <>
            <Button variant="ghost" onClick={closeAsk}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!ask.trim() || pending}
              onClick={() => run(() => requestPlacementInfo({ registrationId: p.id, message: ask }), "Info requested", () => setAsking(false))}
            >
              <Icon name="send" className="size-4" />
              Send
            </Button>
          </>
        }
      >
        <Field label="Message" htmlFor="placement-ask">
          <TextArea id="placement-ask" value={ask} onChange={(e) => setAsk(e.target.value)} rows={4} />
        </Field>
      </Dialog>
      <Toast message={toast} />
    </>
  );
}
