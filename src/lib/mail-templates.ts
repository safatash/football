/** Plain, branded email templates. Each returns subject, text and HTML. */
import { appUrl } from "@/lib/stripe";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const paras = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

/** Wraps a message in the NVASA email frame (pitch green header, lime accent). */
export function layout(opts: { title: string; body: string; cta?: { label: string; href: string } }) {
  const cta = opts.cta
    ? `<p style="margin:22px 0 6px"><a href="${esc(opts.cta.href)}" style="display:inline-block;background:#C8F04A;color:#0F2A12;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F6F1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#13201A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0F3D2E;color:#fff;padding:18px 24px;font-weight:800;letter-spacing:.04em;font-size:20px">NVASA</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">
<h1 style="font-size:22px;margin:0 0 14px">${esc(opts.title)}</h1>${opts.body}${cta}
</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #E3E8DF;font-size:12px;color:#5B6B61">Northern Virginia Adult Soccer Association · Questions? Reply to this email or write to office@nvasa.org</td></tr>
</table></td></tr></table></body></html>`;
}

const footer = "\n\n— NVASA league office · office@nvasa.org";

export function teamUpdateEmail(opts: { teamName: string; captainName: string; message: string; teamId: string }) {
  const subject = `${opts.teamName}: update from ${opts.captainName}`;
  const link = `${appUrl()}/portal`;
  return {
    subject,
    text: `${opts.message}\n\n— ${opts.captainName}, ${opts.teamName} captain\n\nSee your schedule: ${link}${footer}`,
    html: layout({
      title: `Update from ${opts.teamName}`,
      body: `${paras(opts.message)}<p style="margin:0;color:#5B6B61">— ${esc(opts.captainName)}, ${esc(opts.teamName)} captain</p>`,
      cta: { label: "See your schedule", href: link },
    }),
  };
}

export { esc, paras, footer };

export function captainDecisionEmail(opts: { firstName: string; teamName: string; approved: boolean; teamId: string }) {
  const subject = opts.approved ? `You’re a captain of ${opts.teamName}` : `Your captain request for ${opts.teamName}`;
  const body = opts.approved
    ? `Hi ${opts.firstName},\n\nThe league office approved your captain request. You can now set match rosters, lineups and match reports for ${opts.teamName}.`
    : `Hi ${opts.firstName},\n\nThe league office reviewed your captain request for ${opts.teamName} and didn’t approve it this time. You’re still on the team as a player. Reply if you’d like to talk about it.`;
  const link = opts.approved ? `${appUrl()}/captain/${opts.teamId}` : `${appUrl()}/portal`;
  return { subject, text: `${body}\n\n${link}${footer}`, html: layout({ title: subject, body: paras(body), cta: { label: opts.approved ? "Open captain tools" : "Go to your portal", href: link } }) };
}

export function placementInfoEmail(opts: { firstName: string; message: string }) {
  const subject = "A question about your NVASA placement";
  return {
    subject,
    text: `${opts.message}\n\nJust reply to this email.${footer}`,
    html: layout({ title: subject, body: `${paras(opts.message)}<p style="margin:0;color:#5B6B61">Just reply to this email.</p>` }),
  };
}

export function reportReminderEmail(opts: { firstName: string; teamName: string; gameNumber: number; teamId: string }) {
  const subject = `Reminder: match report for Game #${opts.gameNumber}`;
  const body = `Hi ${opts.firstName},\n\nWe haven’t received ${opts.teamName}’s match report for Game #${opts.gameNumber} yet. Please submit the score, scorers and any cards so the standings can be updated.`;
  const link = `${appUrl()}/captain/${opts.teamId}/matches/${opts.gameNumber}/report`;
  return { subject, text: `${body}\n\n${link}${footer}`, html: layout({ title: subject, body: paras(body), cta: { label: "Submit the report", href: link } }) };
}

export function loginLinkEmail(opts: { firstName: string; url: string }) {
  const subject = "Your NVASA login link";
  const body = `Hi ${opts.firstName},\n\nUse this link to log in to NVASA. It works once and expires in 30 minutes.\n\nIf you didn’t ask for it, you can ignore this email.`;
  return { subject, text: `${body}\n\n${opts.url}${footer}`, html: layout({ title: subject, body: paras(body), cta: { label: "Log in to NVASA", href: opts.url } }) };
}

export function passwordResetEmail(opts: { firstName: string; url: string }) {
  const subject = "Reset your NVASA password";
  const body = `Hi ${opts.firstName},\n\nSomeone (hopefully you) asked to reset your NVASA password. Use this link to choose a new one. It works once and expires in 30 minutes.\n\nIf you didn’t ask, you can ignore this email; your password won’t change.`;
  return { subject, text: `${body}\n\n${opts.url}${footer}`, html: layout({ title: subject, body: paras(body), cta: { label: "Choose a new password", href: opts.url } }) };
}

export function registrationReceivedEmail(opts: { firstName: string; seasonName: string; divisionName: string; number: string; paid: boolean }) {
  const subject = `We got your ${opts.seasonName} registration (${opts.number})`;
  const body = `Hi ${opts.firstName},\n\nThanks for registering for ${opts.divisionName}. ${
    opts.paid
      ? "Your payment is in, and the league office will review your registration."
      : "Once your payment goes through, the league office will review your registration."
  } We’ll email you when it’s approved.`;
  const link = `${appUrl()}/portal/registrations`;
  return { subject, text: `${body}\n\n${link}${footer}`, html: layout({ title: "Registration received", body: paras(body), cta: { label: "See my registration", href: link } }) };
}

export function registrationApprovedEmail(opts: { firstName: string; seasonName: string; teamName: string | null; captain: boolean }) {
  const subject = `You’re approved for ${opts.seasonName}`;
  const body = opts.teamName
    ? `Hi ${opts.firstName},\n\nYour registration is approved and you’re on ${opts.teamName}.${opts.captain ? ` You’re also a captain, so you can set match rosters, lineups and match reports.` : ""}`
    : `Hi ${opts.firstName},\n\nYour registration is approved. The league office is placing you on a team and will email you when it’s done.`;
  const link = `${appUrl()}/portal`;
  return { subject, text: `${body}\n\n${link}${footer}`, html: layout({ title: subject, body: paras(body), cta: { label: "Go to my portal", href: link } }) };
}

export function registrationDeniedEmail(opts: { firstName: string; seasonName: string; message: string | null }) {
  const subject = `Your ${opts.seasonName} registration`;
  const body = `Hi ${opts.firstName},\n\nWe weren’t able to approve your ${opts.seasonName} registration.${opts.message ? `\n\n${opts.message}` : ""}\n\nIf you paid, we’ll refund you. Reply to this email with any questions.`;
  return { subject, text: `${body}${footer}`, html: layout({ title: "About your registration", body: paras(body) }) };
}

export function gamePassReceiptEmail(opts: { firstName: string; gameNumber: number; matchLine: string; when: string; field: string | null; teamName: string | null; amount: string; passId: string }) {
  const subject = `Game pass for Game #${opts.gameNumber}`;
  const body = `Hi ${opts.firstName},\n\nYou’re in for Game #${opts.gameNumber}: ${opts.matchLine}, ${opts.when}${opts.field ? ` at ${opts.field}` : ""}.${
    opts.teamName ? ` You’re playing for ${opts.teamName}.` : " The captain or league office will add you to a team."
  }\n\nPaid: ${opts.amount}. The pass covers this match only and expires after it. Arrive 20 minutes early and check in with the referee.`;
  const link = `${appUrl()}/register/game-pass/confirmation?pass=${opts.passId}`;
  return { subject, text: `${body}\n\n${link}${footer}`, html: layout({ title: "Game pass confirmed", body: paras(body), cta: { label: "See my pass", href: link } }) };
}

export function accountInviteEmail(opts: { firstName: string; url: string; teamName: string | null }) {
  const subject = "Your NVASA player account";
  const body = `Hi ${opts.firstName},\n\nThe NVASA league office set up a player account for you${opts.teamName ? ` on ${opts.teamName}` : ""}. Use this link to choose your password. It works once and expires in 7 days.\n\nAfter that you can log in to see your schedule, mark your availability and buy game passes.`;
  return { subject, text: `${body}\n\n${opts.url}${footer}`, html: layout({ title: "Welcome to NVASA", body: paras(body), cta: { label: "Choose a password", href: opts.url } }) };
}

export function paymentLinkEmail(opts: { firstName: string; seasonName: string; divisionName: string; amount: string; url: string }) {
  const subject = `Your ${opts.seasonName} balance: ${opts.amount}`;
  const body = `Hi ${opts.firstName},\n\nYour ${opts.seasonName} ${opts.divisionName} registration has a balance of ${opts.amount}. You can pay it online with a card using the link below. The link always shows your current balance.`;
  return { subject, text: `${body}\n\n${opts.url}${footer}`, html: layout({ title: "Pay your registration", body: paras(body), cta: { label: `Pay ${opts.amount}`, href: opts.url } }) };
}
