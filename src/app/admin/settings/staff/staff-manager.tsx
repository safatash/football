"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { inviteStaff, removeStaff, setStaffRole } from "@/lib/actions/staff";

export type StaffRow = { id: string; email: string; name: string | null; role: "OWNER" | "ADMIN" | "STAFF"; invited: boolean; self: boolean };

const LABEL = { OWNER: "Owner", ADMIN: "Admin", STAFF: "Staff (view only)" } as const;

export function StaffManager({ rows, canManage }: { rows: StaffRow[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");

  const run = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { tone: "ok", text: res.message } : { tone: "bad", text: res.error });
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  function invite(e: FormEvent) {
    e.preventDefault();
    run(() => inviteStaff({ email, role }), () => setEmail(""));
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Card className="flex flex-col divide-y divide-line p-0">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <b className="block truncate">{r.name ?? r.email}</b>
              {r.name ? <span className="block truncate text-[13px] text-muted">{r.email}</span> : null}
            </div>
            {r.invited ? <Badge dot={false}>Invited</Badge> : null}
            {r.self ? <Badge dot={false}>You</Badge> : null}
            {canManage && r.role !== "OWNER" && !r.self ? (
              <>
                <SelectInput
                  aria-label={`Role for ${r.email}`}
                  value={r.role}
                  disabled={pending}
                  onChange={(e) => run(() => setStaffRole({ memberId: r.id, role: e.target.value as "ADMIN" | "STAFF" }))}
                  className="!w-auto"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="STAFF">Staff (view only)</option>
                </SelectInput>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => window.confirm(`Remove league-office access for ${r.email}?`) && run(() => removeStaff({ memberId: r.id }))}>
                  Remove
                </Button>
              </>
            ) : (
              <span className="text-[13.5px] font-bold">{LABEL[r.role]}</span>
            )}
          </div>
        ))}
      </Card>

      {canManage ? (
        <Card>
          <form onSubmit={invite} noValidate className="flex flex-col gap-3">
            <h2 className="text-xl">Invite someone</h2>
            <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
              <Field label="Email" htmlFor="staff-email">
                <TextInput id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Role" htmlFor="staff-role">
                <SelectInput id="staff-role" value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}>
                  <option value="STAFF">Staff (view only)</option>
                  <option value="ADMIN">Admin</option>
                </SelectInput>
              </Field>
              <Button type="submit" variant="primary" disabled={pending || !email.trim()}>
                Send invite
              </Button>
            </div>
            <p className="text-[13px] text-muted">New people get an email to set a password. People who already have an account just log in.</p>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
