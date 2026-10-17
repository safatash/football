"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Screen } from "@/components/shell/layout";

export function ResetForm({ token, valid }: { token: string; valid: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords don’t match.");
    setLoading(true);
    try {
      const res = await fetch("/api/account/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!res.ok || !data.email) throw new Error(data.error || "We couldn’t change your password.");
      const r = await signIn("credentials", { email: data.email, password, redirect: false });
      router.replace(r && !r.error ? "/portal" : "/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t change your password.");
      setLoading(false);
    }
  }

  return (
    <Screen>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] lg:text-[42px]">Choose a new password</h1>
        <p className="text-muted">Use 10 or more characters, with upper and lowercase letters and a number.</p>
      </div>
      {valid ? (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <Field label="New password" htmlFor="rp">
            <TextInput id="rp" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="rc">
            <TextInput id="rc" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" block disabled={loading}>
            {loading ? "Saving…" : "Save new password"}
          </Button>
        </form>
      ) : (
        <>
          <Notice tone="bad" title="This reset link has expired or was already used.">
            Links work once and expire after 30 minutes.
          </Notice>
          <ButtonLink href="/login/forgot" variant="primary">
            Get a new link
          </ButtonLink>
        </>
      )}
    </Screen>
  );
}
