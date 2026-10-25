"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { checkSlug, createOrganizationAction, extendTrial, impersonateAdmin, setOrganizationPlan, setOrganizationStatus, setPlatformFee } from "@/platform/actions";

type Result = { ok: true; message: string } | { ok: false; error: string };

export function PlatformSignOut() {
  return (
    <Button size="sm" variant="ghost" onClick={() => signOut({ callbackUrl: "/login?next=/platform" })}>
      Sign out
    </Button>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "bad", text: r.error });
      if (r.ok) router.refresh();
    });
  return { pending, msg, setMsg, run, start };
}

/** Status, plan, trial and support access for one league. */
export function OrgControls({ id, status, plan, platformFeeBps }: { id: string; status: string; plan: string; platformFeeBps: number }) {
  const { pending, msg, setMsg, run, start } = useRun();
  const [s, setS] = useState(status);
  const [p, setP] = useState(plan);
  const [days, setDays] = useState("14");
  const [fee, setFee] = useState(String(platformFeeBps / 100));
  const [reason, setReason] = useState("");

  function impersonate() {
    if (!window.confirm("Act as this league’s admin for up to 60 minutes? The league’s audit log records it, and a banner shows the whole time.")) return;
    start(async () => {
      const r = await impersonateAdmin({ id, reason });
      if (!r.ok) return setMsg({ tone: "bad", text: r.error });
      window.location.href = r.data!.url;
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-xl">Manage</h2>
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <div className="grid gap-4 md:grid-cols-3 md:items-end">
        <Field label="Status" htmlFor="o-status">
          <SelectInput id="o-status" value={s} onChange={(e) => setS(e.target.value)}>
            {["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"].map((x) => (
              <option key={x} value={x}>
                {x.replace("_", " ").toLowerCase()}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Button disabled={pending || s === status} onClick={() => run(() => setOrganizationStatus({ id, status: s }))}>
          Change status
        </Button>
        <p className="text-[12.5px] text-muted">Suspended and cancelled leagues show “unavailable”; their office can still sign in.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3 md:items-end">
        <Field label="Plan" htmlFor="o-plan">
          <TextInput id="o-plan" value={p} onChange={(e) => setP(e.target.value)} />
        </Field>
        <Button disabled={pending || !p.trim() || p === plan} onClick={() => run(() => setOrganizationPlan({ id, plan: p }))}>
          Save plan
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3 md:items-end">
        <Field label="Platform fee (%)" htmlFor="o-fee" hint="On each online payment. 0 for comped design partners">
          <TextInput id="o-fee" type="number" min={0} max={10} step={0.05} value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
        <Button
          disabled={pending || fee.trim() === "" || Math.round(Number(fee) * 100) === platformFeeBps}
          onClick={() => run(() => setPlatformFee({ id, platformFeeBps: Math.round(Number(fee) * 100) }))}
        >
          Save fee
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3 md:items-end">
        <Field label="Extend trial by (days)" htmlFor="o-days">
          <TextInput id="o-days" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Button disabled={pending || !Number(days)} onClick={() => run(() => extendTrial({ id, days: Number(days) }))}>
          Extend trial
        </Button>
      </div>
      <div className="grid gap-4 border-t border-line pt-4 md:grid-cols-3 md:items-end">
        <Field label="Reason (for the audit log)" htmlFor="o-reason">
          <TextInput id="o-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Ticket 42: fix a schedule" />
        </Field>
        <Button variant="danger" disabled={pending} onClick={impersonate}>
          Impersonate admin
        </Button>
      </div>
    </Card>
  );
}

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/** Name + address (checked as you type) + owner. */
export function NewOrgForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  // The check for the slug it was made for (a stale answer is ignored)
  const [checked, setChecked] = useState<{ slug: string; text: string } | null>(null);
  const avail = slug && checked?.slug === slug ? checked.text : null;

  useEffect(() => {
    if (!slug) return;
    const t = setTimeout(() => checkSlug(slug).then((r) => setChecked({ slug, text: r.ok ? "Available" : r.reason })), 300);
    return () => clearTimeout(t);
  }, [slug]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const r = await createOrganizationAction({
        name,
        slug,
        ownerEmail: String(f.get("owner") ?? ""),
        plan: String(f.get("plan") ?? "pilot"),
        status: String(f.get("status")) === "ACTIVE" ? "ACTIVE" : "TRIAL",
      });
      if (!r.ok) return setError(r.error);
      router.push(`/platform/orgs/${r.data!.id}`);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[640px] flex-col gap-4">
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <Card className="flex flex-col gap-4">
        <Field label="League name" htmlFor="n-name">
          <TextInput
            id="n-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!touched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Address" htmlFor="n-slug" hint={avail ?? "Lower-case letters, numbers and dashes"}>
          <TextInput
            id="n-slug"
            value={slug}
            onChange={(e) => {
              setTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </Field>
        <Field label="Owner’s email" htmlFor="n-owner" hint="An existing login, or a new one (they get an email to set a password)">
          <TextInput id="n-owner" name="owner" type="email" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan" htmlFor="n-plan">
            <TextInput id="n-plan" name="plan" defaultValue="pilot" />
          </Field>
          <Field label="Start as" htmlFor="n-status">
            <SelectInput id="n-status" name="status" defaultValue="TRIAL">
              <option value="TRIAL">Trial (30 days)</option>
              <option value="ACTIVE">Active</option>
            </SelectInput>
          </Field>
        </div>
      </Card>
      <div>
        <Button type="submit" variant="primary" disabled={pending || avail !== "Available" || name.trim().length < 2}>
          Create league
        </Button>
      </div>
    </form>
  );
}
