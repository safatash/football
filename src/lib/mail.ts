import nodemailer, { type Transporter } from "nodemailer";
import { getBrand } from "@/lib/branding";
import { assertNoLeagueTransaction } from "@/lib/db";

export type Mail = { to: string | string[]; subject: string; text: string; html: string; replyTo?: string };

let transport: Transporter | null = null;

const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);

/**
 * Whether to really deliver. Production delivers when SMTP is configured. Anywhere else mail is
 * only logged, unless MAIL_DELIVER=true; even then, outside production it only goes to test
 * addresses (example.com, *.test, or MAIL_TEST_RECIPIENTS) so real players never get dev mail.
 */
function deliverable(to: string) {
  if (!smtpConfigured()) return false;
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.MAIL_DELIVER !== "true") return false;
  const allow = (process.env.MAIL_TEST_RECIPIENTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const addr = to.toLowerCase();
  return /@example\.(com|org|net)$/.test(addr) || /\.test$/.test(addr) || allow.includes(addr);
}

function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transport;
}

/** The platform's sending address: the address part of SMTP_FROM (or SMTP_USER). */
const senderAddress = () => {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "";
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim();
};

/**
 * Who a message is from: "{League} via {App}" at the platform's address (leagues don't send from
 * their own domains), with replies going to the league's contact address.
 */
export async function senderFor(replyTo?: string) {
  const b = await getBrand();
  const name = b.orgId ? `${b.name} via ${b.appName}` : b.appName;
  const address = senderAddress();
  return {
    from: address ? `"${name.replace(/["\\]/g, "")}" <${address}>` : undefined,
    replyTo: replyTo ?? b.contactEmail ?? undefined,
  };
}

/** Sends one message per recipient (players never see each other's addresses). Never throws. */
export async function sendMail(mail: Mail): Promise<{ sent: number; logged: number; failed: number }> {
  assertNoLeagueTransaction("Sending mail");
  const recipients = [...new Set((Array.isArray(mail.to) ? mail.to : [mail.to]).map((r) => r.trim()).filter(Boolean))];
  const result = { sent: 0, logged: 0, failed: 0 };
  const sender = await senderFor(mail.replyTo);
  for (const to of recipients) {
    if (!deliverable(to)) {
      result.logged++;
      if (process.env.NODE_ENV !== "test") console.info(`[mail] (not sent) from=${sender.from ?? "-"} reply-to=${sender.replyTo ?? "-"} to=${to} subject="${mail.subject}"\n${mail.text}\n`);
      continue;
    }
    try {
      await getTransport().sendMail({ ...sender, to, subject: mail.subject, text: mail.text, html: mail.html });
      result.sent++;
    } catch (e) {
      result.failed++;
      console.error(`[mail] failed to=${to} subject="${mail.subject}"`, e instanceof Error ? e.message : e);
    }
  }
  return result;
}
