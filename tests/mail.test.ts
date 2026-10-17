import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: string[] = [];
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: async (m: { to: string }) => void sent.push(m.to) }) },
}));

const mail = { subject: "Hi", text: "Hello", html: "<p>Hello</p>" };

describe("mail delivery guard", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.resetModules();
    vi.stubEnv("SMTP_HOST", "smtp.test");
    vi.stubEnv("SMTP_USER", "user");
    vi.stubEnv("SMTP_PASSWORD", "pw");
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("only logs outside production by default", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sendMail } = await import("@/lib/mail");
    expect(await sendMail({ ...mail, to: ["player@gmail.com", "maya.johnson@example.com"] })).toEqual({ sent: 0, logged: 2, failed: 0 });
    expect(sent).toEqual([]);
  });

  it("with MAIL_DELIVER=true outside production, only test addresses get mail", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MAIL_DELIVER", "true");
    vi.stubEnv("MAIL_TEST_RECIPIENTS", "me@realmail.com");
    const { sendMail } = await import("@/lib/mail");
    const res = await sendMail({ ...mail, to: ["maya.johnson@example.com", "someone@gmail.com", "Me@RealMail.com", "x@club.test"] });
    expect(res).toEqual({ sent: 3, logged: 1, failed: 0 });
    expect(sent).not.toContain("someone@gmail.com");
  });

  it("delivers in production when SMTP is configured, one message per recipient", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sendMail } = await import("@/lib/mail");
    expect(await sendMail({ ...mail, to: ["a@gmail.com", "a@gmail.com", "b@gmail.com"] })).toEqual({ sent: 2, logged: 0, failed: 0 });
  });

  it("logs instead of failing when SMTP isn't configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_HOST", "");
    const { sendMail } = await import("@/lib/mail");
    expect(await sendMail({ ...mail, to: "a@gmail.com" })).toEqual({ sent: 0, logged: 1, failed: 0 });
  });
});

describe("email templates", () => {
  it("escape player-written text and include the link", async () => {
    const { teamUpdateEmail, loginLinkEmail, registrationDeniedEmail } = await import("@/lib/mail-templates");
    const t = teamUpdateEmail({ teamName: "Fairfax United", captainName: "Maya Johnson", message: "Bring <script>water</script> & cleats", teamId: "t1" });
    expect(t.html).toContain("&lt;script&gt;water&lt;/script&gt; &amp; cleats");
    expect(t.text).toContain("Bring <script>water</script> & cleats");
    const l = loginLinkEmail({ firstName: "Maya", url: "http://localhost:3000/login/link?token=abc" });
    expect(l.html).toContain('href="http://localhost:3000/login/link?token=abc"');
    expect(l.text).toContain("expires in 30 minutes");
    expect(registrationDeniedEmail({ firstName: "Sophie", seasonName: "Spring 2026", message: "Outside the area." }).text).toContain("Outside the area.");
  });
});
