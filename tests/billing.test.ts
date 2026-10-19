import { describe, expect, it } from "vitest";
import { billingSummary, payLinkUrl, payLinkValid } from "@/lib/billing";
import { paymentsCsv } from "@/lib/queries/payments-report";

process.env.NEXTAUTH_SECRET ??= "test-secret";

const paid = (amount: number) => ({ amount, status: "PAID" as const, paymentType: "REGISTRATION_FEE" });
const refund = (amount: number) => ({ amount, status: "REFUNDED" as const, paymentType: "REFUND" });
const waiver = (amount: number) => ({ amount, status: "WAIVED" as const, paymentType: "WAIVER" });

describe("billing summary", () => {
  it("goes unpaid → partial → paid", () => {
    expect(billingSummary(95, [])).toMatchObject({ due: 95, paid: 0, balance: 95, status: "UNPAID" });
    expect(billingSummary(95, [paid(50)])).toMatchObject({ paid: 50, balance: 45, status: "PARTIAL" });
    expect(billingSummary(95, [paid(50), paid(45)])).toMatchObject({ paid: 95, balance: 0, status: "PAID" });
  });
  it("waivers cover the rest without counting as money", () => {
    expect(billingSummary(95, [waiver(95)])).toMatchObject({ paid: 0, waived: 95, balance: 0, status: "WAIVED" });
    expect(billingSummary(95, [paid(40), waiver(55)])).toMatchObject({ paid: 40, balance: 0, status: "WAIVED" });
  });
  it("refunds reduce what was paid", () => {
    expect(billingSummary(95, [paid(95), refund(95)])).toMatchObject({ paid: 0, refunded: 95, balance: 95, status: "REFUNDED" });
    expect(billingSummary(95, [paid(95), refund(20)])).toMatchObject({ paid: 75, balance: 20, status: "PARTIAL" });
  });
  it("ignores unpaid and failed rows, and a free registration is paid", () => {
    expect(billingSummary(95, [{ amount: 95, status: "FAILED", paymentType: "REGISTRATION_FEE" }])).toMatchObject({ status: "UNPAID", balance: 95 });
    expect(billingSummary(0, [])).toMatchObject({ status: "PAID", balance: 0 });
  });
});

describe("payment links", () => {
  it("are signed per registration", async () => {
    const url = new URL(await payLinkUrl("reg_123"));
    const sig = url.searchParams.get("sig");
    expect(url.pathname).toBe("/pay/reg_123");
    expect(payLinkValid("reg_123", sig)).toBe(true);
    expect(payLinkValid("reg_456", sig)).toBe(false);
    expect(payLinkValid("reg_123", "nope")).toBe(false);
    expect(payLinkValid("reg_123", null)).toBe(false);
  });
});

describe("payments CSV", () => {
  it("quotes commas and neutralizes formulas", () => {
    const csv = paymentsCsv([
      { id: "1", playerId: "p", date: "2026-05-10", player: "Allen, Sophie", for: "Registration", status: "PAID", amount: 50, net: 50, method: "Check", reference: "=HYPERLINK(1)", recordedBy: "office@nvasa.org", notes: 'Said "thanks"' },
    ]);
    const [head, row] = csv.trim().split("\r\n");
    expect(head).toBe("Date,Player,For,Status,Amount,Net,Method,Reference,Recorded by,Notes");
    expect(row).toBe(`2026-05-10,"Allen, Sophie",Registration,PAID,50.00,50.00,Check,'=HYPERLINK(1),office@nvasa.org,"Said ""thanks"""`);
  });
});
