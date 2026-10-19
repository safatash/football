import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { money } from "@/lib/format";
import { loadPayLink } from "@/lib/pay-link";
import { getBrand } from "@/lib/branding";

export const metadata: Metadata = { title: "Pay your registration", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sig?: string; paid?: string; error?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [link, brand] = await Promise.all([loadPayLink(id, sp.sig), getBrand()]);
  const help = brand.supportEmail || brand.contactEmail;
  const writeTo = help ? `write to ${help}` : "contact the league office";
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col justify-center gap-4 px-4 py-10">
      <span className="font-display text-2xl font-extrabold">{brand.name}</span>
      {!link ? (
        <Notice tone="bad" title="This payment link doesn’t work.">
          Check that you used the whole link from the email, or {writeTo}.
        </Notice>
      ) : (
        <Card className="flex flex-col gap-4">
          <h1 className="text-[30px]">Pay your registration</h1>
          <p className="text-muted">
            {link.reg.player.firstName} {link.reg.player.lastName} · {link.reg.season.name}
            {link.reg.division ? ` · ${link.reg.division.name}` : ""}
          </p>
          {sp.paid ? <Notice tone="ok">Thanks! Your payment went through. It can take a minute to show here.</Notice> : null}
          {sp.error ? <Notice tone="warn">Online payment isn’t available right now. Please try again later or {writeTo}.</Notice> : null}
          <dl className="grid grid-cols-2 gap-y-1.5 text-[15px]">
            <dt className="text-muted">Registration fee</dt>
            <dd className="text-right">{money(link.summary.due)}</dd>
            <dt className="text-muted">Paid</dt>
            <dd className="text-right">{money(link.summary.paid)}</dd>
            {link.summary.waived ? (
              <>
                <dt className="text-muted">Waived</dt>
                <dd className="text-right">{money(link.summary.waived)}</dd>
              </>
            ) : null}
            <dt className="font-bold">Balance</dt>
            <dd className="text-right font-display text-2xl font-extrabold">{money(link.summary.balance)}</dd>
          </dl>
          {link.summary.balance > 0 ? (
            <form action={`/api/pay/${id}`} method="post">
              <input type="hidden" name="sig" value={sp.sig} />
              <Button type="submit" variant="primary" block>
                Pay {money(link.summary.balance)} by card
              </Button>
            </form>
          ) : (
            <Notice tone="ok">Nothing is owed. You’re all set.</Notice>
          )}
        </Card>
      )}
    </main>
  );
}
