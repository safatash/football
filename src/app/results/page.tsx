import type { Metadata } from "next";
import { MatchesPage, type PublicSearchParams } from "@/components/public/matches-page";

export const revalidate = 60;
export const metadata: Metadata = {
  title: "Results",
  description: "NVASA game results: final scores for every division, newest first.",
  alternates: { canonical: "/results" },
};

export default function ResultsPage({ searchParams }: { searchParams: PublicSearchParams }) {
  return <MatchesPage kind="results" searchParams={searchParams} />;
}
