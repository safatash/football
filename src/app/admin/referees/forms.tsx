"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow, Toast, useToast } from "@/components/ui/controls";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { createReferee, deleteReferee, emailWeekAssignments, setOfficialsPaid, updateReferee } from "@/lib/actions/referees";
import { DeleteButton } from "../_components/structure-forms";

export type RefereeValues = { id?: string; name: string; email: string; phone: string; certLevel: string; certExpires: string; center: boolean; assistant: boolean; active: boolean; notes: string };
const LIST = "/admin/referees";
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export function RefereeForm({ referee }: { referee?: RefereeValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [center, setCenter] = useState(referee?.center ?? true);
  const [assistant, setAssistant] = useState(referee?.assistant ?? true);
  const [active, setActive] = useState(referee?.active ?? true);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const values = {
      name: str(f, "name"),
      email: str(f, "email"),
      phone: str(f, "phone"),
      certLevel: str(f, "certLevel"),
      certExpires: str(f, "certExpires") || null,
      positions: [...(center ? ["CENTER" as const] : []), ...(assistant ? ["ASSISTANT" as const] : [])],
      active,
      notes: str(f, "notes"),
    };
    start(async () => {
      setError("");
      const res = referee?.id ? await updateReferee({ ...values, id: referee.id }) : await createReferee(values);
      if (!res.ok) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return setError(res.error);
      }
      const id = referee?.id ?? (res.data as { id: string } | undefined)?.id;
      router.push(`${LIST}/${id}?done=${referee?.id ? "referee-saved" : "referee-created"}&what=${encodeURIComponent(values.name)}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[720px] flex-col gap-4">
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Card className="flex flex-col gap-4">
        <Field label="Name" htmlFor="r-name">
          <TextInput id="r-name" name="name" defaultValue={referee?.name} required autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="r-email" hint="For weekly assignment emails">
            <TextInput id="r-email" name="email" type="email" defaultValue={referee?.email} autoComplete="off" />
          </Field>
          <Field label="Phone" htmlFor="r-phone" hint="Optional">
            <TextInput id="r-phone" name="phone" type="tel" defaultValue={referee?.phone} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Certification" htmlFor="r-cert" hint="e.g. USSF Grade 8">
            <TextInput id="r-cert" name="certLevel" defaultValue={referee?.certLevel} />
          </Field>
          <Field label="Certification expires" htmlFor="r-exp" hint="Optional">
            <TextInput id="r-exp" name="certExpires" type="date" defaultValue={referee?.certExpires} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-bold">Positions</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <CheckRow checked={center} onChange={setCenter} title="Center referee" />
            <CheckRow checked={assistant} onChange={setAssistant} title="Assistant referee" />
          </div>
        </div>
        <CheckRow checked={active} onChange={setActive} title="Active" sub="Inactive referees can’t be assigned but keep their history" />
        <Field label="Notes" htmlFor="r-notes" hint="Optional, for the office">
          <TextInput id="r-notes" name="notes" defaultValue={referee?.notes} />
        </Field>
      </Card>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : referee?.id ? "Save referee" : "Add referee"}
        </Button>
        <ButtonLink href={referee?.id ? `${LIST}/${referee.id}` : LIST} variant="ghost">
          Cancel
        </ButtonLink>
        <span className="flex-1" />
        {referee?.id ? (
          <DeleteButton
            label="Delete referee"
            title={`Delete ${referee.name}?`}
            body="It can’t be undone. Referees with assignments can’t be deleted; set them to inactive instead so their history stays."
            action={() => deleteReferee({ id: referee.id! })}
            doneHref={`${LIST}?done=referee-deleted&what=${encodeURIComponent(referee.name)}`}
          />
        ) : null}
      </div>
    </form>
  );
}

/** Marks a set of assignments paid or unpaid. */
export function PaidToggle({ ids, paid, label }: { ids: string[]; paid: boolean; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, showToast] = useToast();
  return (
    <>
      <Button
        size="sm"
        variant={paid ? "ghost" : "primary"}
        disabled={pending || !ids.length}
        onClick={() =>
          start(async () => {
            const res = await setOfficialsPaid({ ids, paid: !paid });
            showToast(res.ok ? res.message : res.error);
            if (res.ok) router.refresh();
          })
        }
      >
        {pending ? "Saving…" : (label ?? (paid ? "Mark unpaid" : "Mark paid"))}
      </Button>
      <Toast message={toast} />
    </>
  );
}

/** Sends each referee their schedule for the week. */
export function EmailWeekButton({ weekStart, count }: { weekStart: string; count: number }) {
  const [pending, start] = useTransition();
  const [toast, showToast] = useToast(5000);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending || !count}
        onClick={() =>
          start(async () => {
            if (!window.confirm("Email every referee their assignments for this week?")) return;
            const res = await emailWeekAssignments({ weekStart });
            showToast(res.ok ? res.message : res.error);
          })
        }
      >
        <Icon name="mail" className="size-4" />
        {pending ? "Sending…" : "Email assignments"}
      </Button>
      <Toast message={toast} />
    </>
  );
}
