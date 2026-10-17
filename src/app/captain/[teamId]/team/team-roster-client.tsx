"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, RoleTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, Dialog, Toast, useToast } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { Jersey } from "@/components/league";
import { setLineupRole } from "@/lib/actions/captain";
import type { SquadPlayer } from "@/lib/queries/captain";
import { jerseyLabel, rosterStatus, statusTone, type RosterStatus } from "../roster-helpers";

type Editable = Exclude<RosterStatus, "Suspended">;
const ROLE_SUB: Record<Editable, string> = {
  Starter: "In the starting XI",
  Bench: "Available as a sub",
  Unavailable: "Not playing this match",
};

export function TeamRosterClient({ teamId, roster, gameNumber, canEdit }: { teamId: string; roster: SquadPlayer[]; gameNumber: number | null; canEdit: boolean }) {
  const [overrides, setOverrides] = useState<Record<string, Editable>>({});
  const [editing, setEditing] = useState<SquadPlayer | null>(null);
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const statusOf = (p: SquadPlayer) => rosterStatus(p, overrides[p.id]);
  const counts: Record<RosterStatus, number> = { Starter: 0, Bench: 0, Unavailable: 0, Suspended: 0 };
  roster.forEach((p) => counts[statusOf(p)]++);

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="ok">{counts.Starter} starters</Badge>
        <Badge>{counts.Bench} bench</Badge>
        <Badge tone="warn">{counts.Unavailable} unavailable</Badge>
        <Badge tone="bad">{counts.Suspended} suspended</Badge>
      </div>

      <TableWrap>
        <DataTable className="text-sm">
          <TableHead>
            <tr>
              <HeadCell>#</HeadCell>
              <HeadCell>Player</HeadCell>
              <HeadCell>Status</HeadCell>
              <HeadCell align="right">
                <span className="sr-only">Edit</span>
              </HeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {roster.map((p) => {
              const s = statusOf(p);
              return (
                <BodyRow key={p.id}>
                  <BodyCell className="w-12 !pr-0">
                    <Jersey n={jerseyLabel(p.jersey)} small />
                  </BodyCell>
                  <BodyCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <b>{p.name}</b>
                      {p.captain ? <RoleTag role="Captain" /> : null}
                    </span>
                    <span className="text-xs text-muted">{p.pos}</span>
                  </BodyCell>
                  <BodyCell>
                    <Badge tone={statusTone[s]}>{s}</Badge>
                  </BodyCell>
                  <BodyCell align="right">
                    <button
                      type="button"
                      aria-label={`Edit ${p.name}`}
                      disabled={p.suspended || !canEdit}
                      onClick={() => setEditing(p)}
                      className="inline-grid size-11 place-items-center rounded-full border border-line bg-surface hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon name="edit" className="size-4" />
                    </button>
                  </BodyCell>
                </BodyRow>
              );
            })}
          </TableBody>
        </DataTable>
      </TableWrap>
      <p className="text-xs text-muted">Suspended players stay on your roster but can’t be added to a match until the league office lifts the suspension.</p>

      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.name}${editing.jersey != null ? ` · #${editing.jersey}` : ""}` : ""}
        actions={
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Done
          </Button>
        }
      >
        <p className="text-sm text-muted">Set lineup role for {gameNumber ? `Game #${gameNumber}` : "the next match"}.</p>
        {editing ? (
          <ChoiceGroup<Editable>
            name="Lineup role"
            value={statusOf(editing) as Editable}
            onChange={(r) => {
              if (pending) return;
              const p = editing;
              setOverrides((o) => ({ ...o, [p.id]: r }));
              setEditing(null);
              startTransition(async () => {
                const res = await setLineupRole({ teamId, teamRosterId: p.id, role: r });
                if (!res.ok) {
                  setOverrides((o) => {
                    const next = { ...o };
                    delete next[p.id];
                    return next;
                  });
                  return showToast(res.error);
                }
                showToast(res.message);
                router.refresh();
              });
            }}
            options={(Object.keys(ROLE_SUB) as Editable[]).map((r) => ({ value: r, label: r, sub: ROLE_SUB[r] }))}
          />
        ) : null}
      </Dialog>
      <Toast message={toast} />
    </>
  );
}
