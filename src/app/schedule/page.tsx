import type { Metadata } from "next";
import { MatchesPage, type PublicSearchParams } from "@/components/public/matches-page";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Schedule",
  description: "Upcoming NVASA games: dates, kickoff times, fields and directions.",
  alternates: { canonical: "/schedule" },
};

export default function SchedulePage({ searchParams }: { searchParams: PublicSearchParams }) {
  return <MatchesPage kind="schedule" searchParams={searchParams} />;
}
