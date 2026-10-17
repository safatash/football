"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactNode } from "react";
import { Crest, PageHeading } from "@/components/league";
import { PlayerStatusBadge, RoleTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { decideCaptainRequest, liftSuspension, setCaptain, suspendPlayer } from "@/lib/actions/admin";

type Status = "Active" | "Pending Approval" | "Suspended" | "Inactive";
const REASONS = ["Red card", "Yellow card accumulation", "Unpaid fee", "Conduct"];

/** Heading with status badge, suspend / lift actions and the player's note. */
export function PlayerHeader({
  playerId,
  defaultUntil,
  name,
  email,
  status: initial,
  note: initialNote,
  readOnly,
  crumbs,
}: {
  playerId: string;
  /** Default "eligible again" date (YYYY-MM-DD). */
  defaultUntil: string;
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
  const [until, setUntil] = useState(defaultUntil);
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const close = useCallback(() => setOpen(false), []);

  const lift = () =>
    startTransition(async () => {
      const res = await liftSuspension({ playerId });
      showToast(res.ok ? res.message : res.error);
      if (!res.ok) return;
      setStatus("Active");
      setNote(undefined);
      router.refresh();
    });
  const suspend = () =>
    startTransition(async () => {
      const res = await suspendPlayer({ playerId, reason, until: until || null });
      if (!res.ok) return showToast(res.error);
      setStatus("Suspended");
      setNote(res.data?.note);
      setOpen(false);
      showToast(res.message);
      router.refresh();
    });

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
                  disabled={readOnly || pending}
                  onClick={lift}
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
            <Button variant="danger" disabled={pending} onClick={suspend}>
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

type Access = { id: string; name: string; color?: string | null; shortName?: string | null; division: string; membership: string; role: "Captain" | "Player" };

export function TeamAccessTable({ playerId, teams, readOnly }: { playerId: string; teams: Access[]; readOnly?: boolean }) {
  const [roles, setRoles] = useState<Record<string, Access["role"]>>(() => Object.fromEntries(teams.map((t) => [t.id, t.role])));
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
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
                      <Crest team={t} />
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
                      disabled={readOnly || pending}
                      onClick={() =>
                        startTransition(async () => {
                          const next = role === "Captain" ? "Player" : "Captain";
                          const res = await setCaptain({ playerId, teamId: t.id, isCaptain: next === "Captain" });
                          showToast(res.ok ? res.message : res.error);
                          if (!res.ok) return;
                          setRoles((r) => ({ ...r, [t.id]: next }));
                          router.refresh();
                        })
                      }
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

type PendingRequest = { id: string; teamName: string; note: string | null; requested: string };

/** Pending captain requests with approve / deny. Approving gives access on that team only. */
export function CaptainRequests({ requests, readOnly }: { requests: PendingRequest[]; readOnly?: boolean }) {
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const decide = (id: string, approve: boolean) =>
    startTransition(async () => {
      const res = await decideCaptainRequest({ requestId: id, approve });
      showToast(res.ok ? res.message : res.error);
      if (res.ok) router.refresh();
    });
  return (
    <>
      <div className="flex flex-col gap-2.5">
        {requests.map((r) => (
          <Notice key={r.id} tone="pass" icon="star" title={`Captain request · ${r.teamName}`}>
            <span className="block">{r.note ? `“${r.note}”` : "No note."} Requested {r.requested}.</span>
            <span className="mt-2 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" disabled={readOnly || pending} onClick={() => decide(r.id, true)}>
                Approve
              </Button>
              <Button variant="ghost" size="sm" disabled={readOnly || pending} onClick={() => decide(r.id, false)}>
                Deny
              </Button>
            </span>
          </Notice>
        ))}
      </div>
      <Toast message={toast} />
    </>
  );
}
