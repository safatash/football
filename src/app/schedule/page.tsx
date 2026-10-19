import type { Metadata } from "next";
import { getBrand } from "@/lib/branding";
import { MatchesPage, type PublicSearchParams } from "@/components/public/matches-page";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return { title: "Schedule", description: `Upcoming ${b.name} games: dates, kickoff times, fields and directions.`, alternates: { canonical: "/schedule" } };
}

export default function SchedulePage({ searchParams }: { searchParams: PublicSearchParams }) {
  return <MatchesPage kind="schedule" searchParams={searchParams} />;
}
