import prisma from "@/lib/prisma";
import { BLOCKLIST, EXTRA_ZIPS } from "@/lib/league-data";
import { ArchivedNotice, isArchived, seasonFrom, type SearchParams } from "../_components/season";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Fees & eligibility" };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const season = seasonFrom(await searchParams);

  let zips = EXTRA_ZIPS;
  let blocklist = BLOCKLIST;
  try {
    const rows = await prisma.allowedZipCode.findMany({ orderBy: { zipCode: "asc" }, select: { zipCode: true } });
    zips = rows.map((r) => r.zipCode);
  } catch {
    zips = EXTRA_ZIPS;
  }
  try {
    const rows = await prisma.blocklist.findMany({ orderBy: { blockedAt: "desc" }, select: { email: true } });
    blocklist = rows.map((r) => r.email);
  } catch {
    blocklist = BLOCKLIST;
  }

  return <SettingsForm zips={zips} blocklist={blocklist} readOnly={isArchived(season)} notice={<ArchivedNotice season={season} />} />;
}
