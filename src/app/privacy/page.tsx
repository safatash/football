import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/card";
import { PageTitle, PublicFrame } from "@/components/public";
import { getBrand } from "@/lib/branding";

// Per league (its name and contacts), so rendered per request
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return { title: "Privacy policy", description: `How ${b.name} and ${b.appName} handle your personal information.`, alternates: { canonical: "/privacy" } };
}

/**
 * TODO(legal): placeholder. Replace the sections below with the final privacy policy before
 * launch (have it reviewed; it must match what the app actually collects and who processes it).
 */
export default async function PrivacyPage() {
  const b = await getBrand();
  const league = b.orgId ? b.name : null;
  const contact = b.supportEmail ?? b.contactEmail;
  const sections: [string, string][] = [
    [
      "Who we are",
      league
        ? `${league} runs this league site on ${b.appName}, a service for adult recreational soccer leagues. ${league} decides what information it collects; ${b.appName} stores and processes it for them.`
        : `${b.appName} is a service that adult recreational soccer leagues use to run registration, payments, schedules and standings.`,
    ],
    ["What we collect", "Account details (name, email, password), player details (date of birth, gender, phone, address, emergency contact, position), registrations and team membership, match results and stats, and payment records. Card details go straight to Stripe and never reach our servers."],
    ["Why we use it", "To run the league: check eligibility, place players on teams, contact you about matches and registration, take payments and keep the league's records."],
    ["Who we share it with", "Your league's office and, for your team, your captains. Service providers that help run the site: Stripe (payments), our email provider, our hosting and database providers, and error monitoring. We don't sell personal information."],
    ["How long we keep it", "While you play in the league and as long as the league needs its records. Payment records are kept for accounting even after an account is deleted."],
    ["Your choices", "You can see and edit your details on your profile, and delete your account there. Deleting removes your personal details; the league keeps anonymous payment and ledger records."],
  ];
  return (
    <PublicFrame>
      <PageTitle title="Privacy policy" sub={league ? `${league} on ${b.appName}` : b.appName} />
      <Notice tone="warn" title="Draft">
        This is a placeholder while the final privacy policy is being written. Questions in the meantime: {contact ? <a className="font-bold underline" href={`mailto:${contact}`}>{contact}</a> : "contact your league office"}.
      </Notice>
      <div className="flex max-w-[720px] flex-col gap-5">
        {sections.map(([title, body]) => (
          <section key={title} className="flex flex-col gap-1.5">
            <h2 className="text-xl">{title}</h2>
            <p className="text-muted">{body}</p>
          </section>
        ))}
        <p className="text-sm text-muted">
          Delete your account from <Link href="/portal/profile" className="font-bold underline">your profile</Link>.
        </p>
      </div>
    </PublicFrame>
  );
}
