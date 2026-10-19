import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/card";
import type { demoSummary } from "@/lib/demo";

/** Marks a seeded team or player. */
export function DemoBadge() {
  return (
    <Badge tone="info" dot={false} className="!h-5 !px-2 text-[11px]">
      Demo
    </Badge>
  );
}

/** Shown on every league-office page while seed data is still in the database. */
export function AdminDemoNotice({ summary }: { summary: Awaited<ReturnType<typeof demoSummary>> }) {
  if (!summary.any) return null;
  return (
    <Notice tone="warn" title="Demo data">
      {summary.teams} teams, {summary.matches} matches, {summary.players} players, {summary.parks} parks and {summary.referees} referees are sample data from the seed, marked <b>Demo</b>. They aren’t real.{" "}
      <Link href="/admin/settings#demo-data" className="font-bold underline underline-offset-4">
        Clear demo data
      </Link>
    </Notice>
  );
}
