"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/controls";
import { inputClass } from "@/components/ui/field";
import { setLeagueOfficeAccess } from "@/lib/actions/admin";
import type { LeagueOfficeMember } from "@/lib/queries/admin-league";

const small = `${inputClass} !h-10 text-[15px]`;

/** Who can use the league office, with add-by-email and remove. */
export function LeagueOffice({ members, selfId }: { members: LeagueOfficeMember[]; selfId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (target: string, admin: boolean, onOk?: () => void) =>
    startTransition(async () => {
      const res = await setLeagueOfficeAccess({ email: target, admin });
      if (!res.ok) {
        if (admin) setError(res.error);
        else showToast(res.error);
        return;
      }
      onOk?.();
      showToast(res.message);
      router.refresh();
    });

  function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setError("Enter an email address.");
    run(v, true, () => setEmail(""));
  }

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-[19px] font-bold">League office</h3>
      <p className="text-[13px] text-muted">People who can use these screens. They need an NVASA account first.</p>
      <ul className="flex flex-col overflow-hidden rounded-[var(--radius-field)] border border-line">
        {members.map((m) => (
          <li key={m.email} className="flex min-h-11 items-center gap-3 border-b border-line px-3.5 py-2 last:border-b-0">
            <span className="min-w-0 flex-1">
              {m.playerId ? (
                <Link href={`/admin/players/${m.playerId}`} className="block truncate text-sm font-bold hover:underline">
                  {m.name}
                </Link>
              ) : null}
              <span className="block truncate font-mono text-[13px]">{m.email}</span>
            </span>
            {m.viaSetting ? (
              <Badge dot={false}>{m.hasAccount ? "ADMIN_EMAILS" : "No account yet"}</Badge>
            ) : m.userId === selfId ? (
              <Badge dot={false}>You</Badge>
            ) : (
              <button
                type="button"
                disabled={pending}
                className="min-h-11 text-[13px] font-bold text-bad underline underline-offset-4"
                onClick={() => run(m.email, false)}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input className={`${small} flex-1`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email of an existing account" aria-label="Give league-office access" aria-invalid={!!error} />
        <Button type="submit" variant="ghost" size="sm" className="!min-h-10" disabled={pending}>
          Add
        </Button>
      </form>
      {error ? <span className="text-[12.5px] font-semibold text-bad">{error}</span> : null}
      <Toast message={toast} />
    </Card>
  );
}
