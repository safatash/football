"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/controls";
import { Field, TextInput } from "@/components/ui/field";
import { changePassword, type PasswordState } from "./password-actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePassword, null);
  const [toast, showToast] = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      showToast(state.message);
      formRef.current?.reset();
    }
  }, [state, showToast]);

  const err = (k: string) => (state && !state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card>
      <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
        <h3 className="text-[19px] font-bold">Change password</h3>
        {state && !state.ok && !state.fieldErrors ? <Notice tone="bad">{state.error}</Notice> : null}
        <Field label="Current password" htmlFor="pw-current" error={err("currentPassword")}>
          <TextInput id="pw-current" name="currentPassword" type="password" autoComplete="current-password" required aria-invalid={!!err("currentPassword") || undefined} />
        </Field>
        <Field label="New password" htmlFor="pw-new" hint="10+ characters with an uppercase letter, a lowercase letter and a number" error={err("newPassword")}>
          <TextInput id="pw-new" name="newPassword" type="password" autoComplete="new-password" required aria-invalid={!!err("newPassword") || undefined} />
        </Field>
        <Field label="Confirm new password" htmlFor="pw-confirm" error={err("confirmPassword")}>
          <TextInput id="pw-confirm" name="confirmPassword" type="password" autoComplete="new-password" required aria-invalid={!!err("confirmPassword") || undefined} />
        </Field>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
      </form>
      <Toast message={toast} />
    </Card>
  );
}
