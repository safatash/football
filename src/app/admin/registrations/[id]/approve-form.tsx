"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Dialog, Switch, Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { reopenRegistration } from "@/lib/actions/admin";

export type DecisionReg = {
  id: string;
  name: string;
  email: string;
  status: "open" | "approved" | "denied" | "cancelled";
  /** lower-case payment label, e.g. "paid", "unpaid", "pending" */
  payment: string;
  paid: boolean;
  amount: string;
  divisionName: string | null;
  captainRequested: boolean;
  hasPreference: boolean;
};
export type TeamOption = { id: string; name: string; label: string };
export type TeamGroup = { label: string; options: TeamOption[] };

const DENY_REASONS = ["Outside the eligible area", "Doesn’t meet the division age rule", "Duplicate registration", "Email on blocklist", "Other"];

/**
 * Decision card for a registration. `api` mode saves through /api/admin/registrations/:id;
 * `local` mode keeps the decision on the page without saving.
 */
export function ApproveRegistrationForm({
  mode,
  registration: r,
  teams,
  defaultTeamId,
  readOnly,
}: {
  mode: "api" | "local";
  registration: DecisionReg;
  teams: TeamGroup[];
  defaultTeamId: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [toast, showToast] = useToast();
  const [status, setStatus] = useState(r.status);
  const [teamId, setTeamId] = useState(defaultTeamId);
  const [captain, setCaptain] = useState(r.captainRequested);
  const [dialog, setDialog] = useState<"approve" | "deny" | null>(null);
  const [reason, setReason] = useState(DENY_REASONS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const closeDialog = useCallback(() => {
    if (!busy) setDialog(null);
  }, [busy]);

  const all = teams.flatMap((g) => g.options);
  const chosen = all.find((t) => t.id === teamId);
  const makeCaptain = captain && !!chosen;
  const first = r.name.split(" ")[0];

  async function send(path: "approve" | "deny", body: unknown) {
    if (mode === "local") return true;
    const res = await fetch(`/api/admin/registrations/${encodeURIComponent(r.id)}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return true;
  }

  async function approve() {
    setBusy(true);
    setError("");
    try {
      await send("approve", { teamId: chosen?.id ?? null, makeCaptain });
      setStatus("approved");
      setDialog(null);
      showToast(`${r.name} approved`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deny() {
    setBusy(true);
    setError("");
    try {
      await send("deny", { reason, message: message.trim() || undefined });
      setStatus("denied");
      setDialog(null);
      showToast(`${r.name} denied`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const open = status === "open";

  return (
    <Card className="sticky top-20 flex flex-col gap-3.5">
      <h3 className="text-[19px] font-bold">Decision</h3>

      {open && !readOnly ? (
        <>
          <Field
            label="Assign to team"
            htmlFor="decision-team"
            hint={!r.hasPreference ? "No team requested. Pick one or leave it for placement." : undefined}
          >
            <SelectInput id="decision-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Send to placement queue</option>
              {teams.length === 1 ? (
                teams[0].options.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))
              ) : (
                teams.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
            </SelectInput>
          </Field>

          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <b className="text-sm">Make captain</b>
              <div className="text-xs text-muted">{chosen ? `Gives captain access on ${chosen.name} only` : "Assign a team first"}</div>
            </div>
            <Switch checked={makeCaptain} onChange={setCaptain} label="Make captain" disabled={!chosen} />
          </div>

          {!r.paid ? (
            <Notice tone="warn">
              Payment is {r.payment}. Approving keeps the player limited until it’s paid.
            </Notice>
          ) : null}
          {error && !dialog ? <Notice tone="bad">{error}</Notice> : null}

          <Button variant="primary" block onClick={() => { setError(""); setDialog("approve"); }}>
            <Icon name="check" className="size-4" />
            {chosen ? "Approve" : "Approve & send to placement"}
          </Button>
          <Button variant="ghost" block className="text-bad" onClick={() => { setError(""); setDialog("deny"); }}>
            Deny registration
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            {open
              ? "Decisions are turned off for closed seasons."
              : status === "approved"
                ? "This registration was approved."
                : status === "denied"
                  ? "This registration was denied."
                  : "This registration was cancelled."}
          </p>
          {status === "denied" && !readOnly ? (
            <Button
              variant="ghost"
              block
              disabled={busy}
              onClick={async () => {
                if (mode === "local") {
                  setStatus("open");
                  return showToast("Reopened for review");
                }
                setBusy(true);
                const res = await reopenRegistration({ registrationId: r.id });
                setBusy(false);
                showToast(res.ok ? res.message : res.error);
                if (res.ok) {
                  setStatus("open");
                  router.refresh();
                }
              }}
            >
              Reopen
            </Button>
          ) : null}
        </>
      )}

      <Dialog
        open={dialog === "approve"}
        onClose={closeDialog}
        title={`Approve ${r.name}?`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={approve} disabled={busy}>
              {busy ? "Approving…" : "Approve"}
            </Button>
          </>
        }
      >
        <p className="text-muted">
          {chosen ? (
            <>
              {r.name} joins <b className="text-fg">{chosen.name}</b> as a {makeCaptain ? <b className="text-fg">captain</b> : "player"}.
            </>
          ) : (
            <>
              {r.name} goes to the placement queue{r.divisionName ? ` for ${r.divisionName}` : ""}.
            </>
          )}
        </p>
        {error ? <Notice tone="bad">{error}</Notice> : null}
      </Dialog>

      <Dialog
        open={dialog === "deny"}
        onClose={closeDialog}
        title="Deny registration"
        actions={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deny} disabled={busy}>
              {busy ? "Denying…" : "Deny"}
            </Button>
          </>
        }
      >
        <p className="text-muted">
          {first}’s registration will be marked denied{r.paid ? `. They paid ${r.amount}, so check whether a refund is due` : ""}.
        </p>
        <Field label="Reason" htmlFor="deny-reason">
          <SelectInput id="deny-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
            {DENY_REASONS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Message to player" htmlFor="deny-message">
          <TextArea id="deny-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional" maxLength={2000} />
        </Field>
        {error ? <Notice tone="bad">{error}</Notice> : null}
      </Dialog>

      <Toast message={toast} />
    </Card>
  );
}
