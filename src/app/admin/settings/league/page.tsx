import { PageHeading } from "@/components/league";
import { db, getOrgId } from "@/lib/db";
import { brandFor } from "@/lib/branding";
import { getSession } from "@/lib/session";
import { LeagueProfileForm } from "./profile-form";

export const metadata = { title: "League profile" };

export default async function LeagueProfilePage() {
  const orgId = await getOrgId();
  const [brand, settings, session] = await Promise.all([brandFor(orgId), db.organizationSettings.findFirst({ select: { waiverText: true } }), getSession()]);
  const readOnly = session?.user?.orgRole === "STAFF";
  return (
    <>
      <PageHeading title="League profile" sub="Your league’s name, logo, colors and contacts, used on every page and email." />
      <LeagueProfileForm
        readOnly={readOnly}
        blobReady={Boolean(process.env.BLOB_READ_WRITE_TOKEN)}
        timezones={Intl.supportedValuesOf("timeZone")}
        values={{
          name: brand.name,
          fullName: brand.fullName === brand.name ? "" : brand.fullName,
          tagline: brand.tagline ?? "",
          primaryColor: brand.primaryColor ?? "",
          accentColor: brand.accentColor ?? "",
          contactEmail: brand.contactEmail ?? "",
          supportEmail: brand.supportEmail === brand.contactEmail ? "" : (brand.supportEmail ?? ""),
          timezone: brand.timezone,
          waiverText: settings?.waiverText ?? "",
          logoUrl: brand.logoUrl ?? "",
          facebookUrl: brand.social.find((s) => s.label === "Facebook")?.url ?? "",
          twitterUrl: brand.social.find((s) => s.label === "X (Twitter)")?.url ?? "",
          instagramUrl: brand.social.find((s) => s.label === "Instagram")?.url ?? "",
        }}
        url={brand.url}
      />
    </>
  );
}
