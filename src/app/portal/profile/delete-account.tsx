"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { deleteMyAccount } from "@/lib/actions/account";

/** Profile › Delete account: the player types their email to confirm, then is signed out. */
export function DeleteAccount({ email, leagueName }: { email: string; leagueName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <Button variant="ghost" block onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-[19px] font-bold">Delete your account</h3>
      <p className="text-sm text-muted">
        This removes your name, contact details, date of birth and emergency contact from {leagueName}, takes you off your teams and signs you out. {leagueName} keeps
        its registration and payment records, without your details. It can’t be undone. <Link href="/privacy" className="font-bold underline">Privacy policy</Link>
      </p>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Field label={`Type ${email} to confirm`} htmlFor="del-confirm">
        <TextInput id="del-confirm" type="email" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={pending || confirm.trim().toLowerCase() !== email.toLowerCase()}
          onClick={() =>
            start(async () => {
              setError("");
              const res = await deleteMyAccount({ confirmEmail: confirm });
              if (!res.ok) return setError(res.error);
              await signOut({ callbackUrl: "/?account=deleted" });
            })
          }
        >
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
      </div>
    </Card>
  );
}
