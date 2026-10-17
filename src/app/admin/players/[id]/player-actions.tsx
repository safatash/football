"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Crest, PageHeading } from "@/components/league";
import { PlayerStatusBadge, RoleTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";

type Status = "Active" | "Pending Approval" | "Suspended";
const REASONS = ["Red card", "Yellow card accumulation", "Unpaid fee", "Conduct"];

/** Heading with status badge, suspend / lift actions and the player's note. */
export function PlayerHeader({
  name,
  email,
  status: initial,
  note: initialNote,
  readOnly,
  crumbs,
}: {
  name: string;
  email: string;
  status: Status;
  note?: string;
  readOnly?: boolean;
  crumbs: ReactNode;
}) {
  const [status, setStatus] = useState<Status>(initial);
  const [note, setNote] = useState(initialNote);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [until, setUntil] = useState("2026-05-31");
  const [toast, showToast] = useToast();
  const close = useCallback(() => setOpen(false), []);
  const untilLabel = until ? new Date(`${until}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <>
      <div className="flex flex-col gap-2">
        {crumbs}
        <PageHeading
          title={name}
          sub={email}
          actions={
            <>
              <PlayerStatusBadge status={status} />
              {status === "Suspended" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => {
                    setStatus("Active");
                    setNote(undefined);
                    showToast("Suspension lifted");
                  }}
                >
                  Lift suspension
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-bad" disabled={readOnly} onClick={() => setOpen(true)}>
                  Suspend
                </Button>
              )}
            </>
          }
        />
      </div>
      {note ? (
        <Notice tone={status === "Suspended" ? "bad" : "pass"} icon={status === "Suspended" ? "alert" : "ticket"}>
          {note}
        </Notice>
      ) : null}

      <Dialog
        open={open}
        onClose={close}
        title={`Suspend ${name}?`}
        actions={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setStatus("Suspended");
                setNote(`${reason}.${untilLabel ? ` Eligible again ${untilLabel}.` : ""}`);
                setOpen(false);
                showToast("Player suspended");
              }}
            >
              Suspend
            </Button>
          </>
        }
      >
        <p className="text-muted">They stay on their team’s roster but can’t be added to match rosters or buy game passes.</p>
        <Field label="Reason" htmlFor="suspend-reason">
          <SelectInput id="suspend-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Eligible again" htmlFor="suspend-until">
          <TextInput id="suspend-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </Field>
      </Dialog>
      <Toast message={toast} />
    </>
  );
}

type Access = { id: string; name: string; division: string; membership: string; role: "Captain" | "Player" };

export function TeamAccessTable({ teams, readOnly }: { teams: Access[]; readOnly?: boolean }) {
  const [roles, setRoles] = useState<Record<string, Access["role"]>>(() => Object.fromEntries(teams.map((t) => [t.id, t.role])));
  const [toast, showToast] = useToast();
  return (
    <>
      <TableWrap>
        <DataTable>
          <TableHead>
            <tr>
              <HeadCell>Team</HeadCell>
              <HeadCell>Division</HeadCell>
              <HeadCell>Membership</HeadCell>
              <HeadCell>Access</HeadCell>
              <HeadCell align="right">Change</HeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {teams.map((t) => {
              const role = roles[t.id];
              return (
                <BodyRow key={t.id}>
                  <BodyCell>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Crest teamId={t.id} />
                      <b>{t.name}</b>
                    </span>
                  </BodyCell>
                  <BodyCell className="whitespace-nowrap">{t.division}</BodyCell>
                  <BodyCell className="whitespace-nowrap">{t.membership}</BodyCell>
                  <BodyCell>
                    <RoleTag role={role} />
                  </BodyCell>
                  <BodyCell align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={readOnly}
                      onClick={() => {
                        const next = role === "Captain" ? "Player" : "Captain";
                        setRoles((r) => ({ ...r, [t.id]: next }));
                        showToast(`${role === "Captain" ? "Captain access removed" : "Captain access granted"} on ${t.name}`);
                      }}
                    >
                      {role === "Captain" ? "Remove captain" : "Make captain"}
                    </Button>
                  </BodyCell>
                </BodyRow>
              );
            })}
          </TableBody>
        </DataTable>
      </TableWrap>
      <Toast message={toast} />
    </>
  );
}
