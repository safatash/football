"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { PaymentBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { applyDiscountCode, recordPayment, refundPayment, sendPaymentLink, waiveBalance } from "@/lib/actions/billing";
import type { ActionResult } from "@/lib/actions/result";
import type { PlayerBilling } from "@/lib/queries/billing";

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
const METHODS = [
  ["CASH", "Cash"],
  ["CHECK", "Check"],
  ["ZELLE", "Zelle"],
  ["VENMO", "Venmo"],
  ["CARD_IN_PERSON", "Card in person"],
  ["OTHER", "Other"],
] as const;
type Method = (typeof METHODS)[number][0] | "STRIPE";
type Dialogs = "record" | "link" | "waive" | "refund" | "discount" | null;

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[$,\s]/g, "");
  return s === "" ? NaN : Number(s);
};

function Summary({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      <span className={strong ? "font-display text-[28px] leading-none font-extrabold" : "text-lg font-bold"}>{value}</span>
    </div>
  );
}

/** Billing on the player page: balance, payment history, activity and the office's billing actions. */
export function BillingPanel({ billing, readOnly }: { billing: PlayerBilling; readOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<Dialogs>(null);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<Method>("CHECK");
  const [toast, showToast] = useToast(4000);
  const [pending, start] = useTransition();
  const { summary } = billing;

  const show = (d: Dialogs) => () => (setError(""), setOpen(d));
  const run = (fn: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error);
      setOpen(null);
      showToast(res.message);
      router.refresh();
    });
  const submit = (fn: (f: FormData) => Promise<ActionResult<unknown>>) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() => fn(f));
  };
  const id = billing.registrationId;
  const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

  const formDialog = (key: Exclude<Dialogs, null>, title: string, action: string, onSubmit: (f: FormData) => Promise<ActionResult<unknown>>, body: ReactNode, danger?: boolean) => (
    <Dialog
      open={open === key}
      onClose={() => setOpen(null)}
      title={title}
      actions={
        <>
          <Button variant="ghost" onClick={() => setOpen(null)}>
            Cancel
          </Button>
          <Button type="submit" form={`billing-${key}`} variant={danger ? "danger" : "primary"} disabled={pending}>
            {pending ? "Saving…" : action}
          </Button>
        </>
      }
    >
      <form id={`billing-${key}`} onSubmit={submit(onSubmit)} noValidate className="flex flex-col gap-3">
        {error ? <Notice tone="bad">{error}</Notice> : null}
        {body}
      </form>
    </Dialog>
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[19px] font-bold">Billing</h3>
        <PaymentBadge status={summary.status} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Summary label="Amount due" value={money(summary.due)} />
        <Summary label="Paid" value={money(summary.paid)} />
        {summary.waived ? <Summary label="Waived" value={money(summary.waived)} /> : null}
        <Summary label="Balance" value={money(summary.balance)} strong />
      </div>
      <p className="text-[13px] text-muted">
        {billing.division ? `${billing.division} fee ${money(billing.fee)}` : `Fee ${money(billing.fee)}`}
        {billing.discount ? ` − ${billing.discount.code} ${money(billing.discount.amount)}` : ""}
        {summary.refunded ? ` · ${money(summary.refunded)} refunded` : ""}
      </p>

      {readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={show("record")} disabled={summary.balance <= 0}>
            Record payment
          </Button>
          <Button size="sm" variant="ghost" onClick={show("link")} disabled={summary.balance <= 0}>
            Send payment link
          </Button>
          <Button size="sm" variant="ghost" onClick={show("waive")} disabled={summary.balance <= 0}>
            Waive / comp
          </Button>
          <Button size="sm" variant="ghost" onClick={show("refund")} disabled={summary.paid <= 0}>
            Refund
          </Button>
          <Button size="sm" variant="ghost" onClick={show("discount")}>
            Apply discount code
          </Button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h4 className="font-bold">Payment history</h4>
        {billing.ledger.length ? (
          <TableWrap>
            <DataTable className="text-[13.5px]">
              <TableHead>
                <tr>
                  <HeadCell>Date</HeadCell>
                  <HeadCell>Type</HeadCell>
                  <HeadCell align="right">Amount</HeadCell>
                  <HeadCell>Method</HeadCell>
                  <HeadCell>Reference</HeadCell>
                  <HeadCell>Recorded by</HeadCell>
                  <HeadCell>Notes</HeadCell>
                </tr>
              </TableHead>
              <TableBody>
                {billing.ledger.map((r) => (
                  <BodyRow key={r.id}>
                    <BodyCell className="whitespace-nowrap">{r.date}</BodyCell>
                    <BodyCell>{r.kind}</BodyCell>
                    <BodyCell align="right" className="font-bold whitespace-nowrap">
                      {r.sign < 0 ? "−" : ""}
                      {money(r.amount)}
                    </BodyCell>
                    <BodyCell className="whitespace-nowrap">{r.method}</BodyCell>
                    <BodyCell>{r.reference || "—"}</BodyCell>
                    <BodyCell className="max-w-[180px] truncate" >{r.recordedBy}</BodyCell>
                    <BodyCell className="min-w-[160px] text-muted">{r.notes || "—"}</BodyCell>
                  </BodyRow>
                ))}
              </TableBody>
            </DataTable>
          </TableWrap>
        ) : (
          <p className="text-[13.5px] text-muted">No payments yet.</p>
        )}
      </section>

      {billing.activity.length ? (
        <details className="text-[13.5px]">
          <summary className="cursor-pointer font-bold">Billing activity ({billing.activity.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {billing.activity.map((a) => (
              <li key={a.id}>
                <span className="text-muted">{a.when} · {a.who}</span> · {a.summary}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {formDialog(
        "record",
        "Record payment",
        "Record payment",
        (f) => recordPayment({ registrationId: id, amount: num(f.get("amount")), method: method as Method, reference: str(f, "reference"), paidOn: str(f, "paidOn"), notes: str(f, "notes") }),
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount" htmlFor="b-amount" hint={`Balance ${money(summary.balance)}. Partial payments are fine.`}>
              <TextInput id="b-amount" name="amount" inputMode="decimal" defaultValue={String(summary.balance)} />
            </Field>
            <Field label="Date paid" htmlFor="b-date">
              <TextInput id="b-date" name="paidOn" type="date" defaultValue={today()} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Method" htmlFor="b-method">
              <SelectInput id="b-method" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                {METHODS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={method === "CHECK" ? "Check number" : "Reference"} htmlFor="b-ref" hint="Optional">
              <TextInput id="b-ref" name="reference" autoComplete="off" />
            </Field>
          </div>
          <Field label="Notes" htmlFor="b-notes" hint="Optional">
            <TextInput id="b-notes" name="notes" />
          </Field>
        </>,
      )}

      <Dialog
        open={open === "link"}
        onClose={() => setOpen(null)}
        title="Send payment link"
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending} onClick={() => run(() => sendPaymentLink({ registrationId: id }))}>
              {pending ? "Sending…" : `Email link for ${money(summary.balance)}`}
            </Button>
          </>
        }
      >
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <p className="text-muted">They get an email with a link to pay the balance by card (Stripe). The link always charges the current balance, so it stays right after other payments.</p>
      </Dialog>

      {formDialog(
        "waive",
        "Waive the balance",
        `Waive ${money(summary.balance)}`,
        (f) => waiveBalance({ registrationId: id, reason: str(f, "reason") }),
        <>
          <p className="text-muted">Comps the remaining {money(summary.balance)}. It’s recorded in the payment history, not deleted.</p>
          <Field label="Reason" htmlFor="b-wreason" hint="Required, e.g. “Board member” or “Hardship”">
            <TextInput id="b-wreason" name="reason" />
          </Field>
        </>,
      )}

      {formDialog(
        "refund",
        "Record a refund",
        "Record refund",
        (f) => refundPayment({ registrationId: id, amount: num(f.get("amount")), reason: str(f, "reason"), method: (str(f, "method") || "OTHER") as Method, reference: str(f, "reference") }),
        <>
          <Notice tone="info">This records the refund. Send the money back yourself (Stripe dashboard, check or cash).</Notice>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount" htmlFor="b-ramount" hint={`Up to ${money(summary.paid)}`}>
              <TextInput id="b-ramount" name="amount" inputMode="decimal" defaultValue={String(summary.paid)} />
            </Field>
            <Field label="Refunded by" htmlFor="b-rmethod">
              <SelectInput id="b-rmethod" name="method" defaultValue="STRIPE">
                {[...METHODS, ["STRIPE", "Stripe"] as const].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <Field label="Reason" htmlFor="b-rreason" hint="Required">
            <TextInput id="b-rreason" name="reason" />
          </Field>
          <Field label="Reference" htmlFor="b-rref" hint="Optional">
            <TextInput id="b-rref" name="reference" />
          </Field>
        </>,
        true,
      )}

      {formDialog(
        "discount",
        "Apply a discount code",
        "Apply code",
        (f) => applyDiscountCode({ registrationId: id, code: str(f, "code") }),
        <Field label="Discount code" htmlFor="b-code" hint="Replaces any code already on this registration.">
          <TextInput id="b-code" name="code" autoComplete="off" className="uppercase" />
        </Field>,
      )}
      <Toast message={toast} />
    </Card>
  );
}
