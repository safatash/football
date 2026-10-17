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
