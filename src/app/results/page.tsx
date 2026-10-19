import type { Metadata } from "next";
import { getBrand } from "@/lib/branding";
import { MatchesPage, type PublicSearchParams } from "@/components/public/matches-page";

export const revalidate = 60;
export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrand();
  return { title: "Results", description: `${b.name} game results: final scores for every division, newest first.`, alternates: { canonical: "/results" } };
}

export default function ResultsPage({ searchParams }: { searchParams: PublicSearchParams }) {
  return <MatchesPage kind="results" searchParams={searchParams} />;
}
