import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { AppBar, Screen } from "@/components/shell/layout";
import prisma from "@/lib/prisma";
import { money } from "@/lib/format";
import { getActiveSeason, getSettings } from "@/lib/queries/season";

export const metadata: Metadata = { title: "Join NVASA" };

// Fees come from the active season's settings.
export const dynamic = "force-dynamic";

type Path = {
  eyebrow: string;
  title: string;
  price: string;
  body: string;
  login: string;
  find: string;
  start: string;
  startLabel: string;
  accent: boolean;
};

const paths = ({ season, minFee, gamePassFee }: { season: string; minFee: number; gamePassFee: number }): Path[] => [
  {
    eyebrow: season ? `${season} season` : "Season",
    title: "Season registration",
    price: `${money(minFee)}+`,
    body: "Join a team for every match this season. Reviewed by the league office.",
    login: "/login?next=/register/new",
    find: "/retrieve",
    start: "/register/new",
    startLabel: "Start registration",
    accent: true,
  },
  {
    eyebrow: "One match",
    title: "Game pass",
    price: money(gamePassFee),
    body: "Valid for one match on its game day. You won’t join a team roster.",
    login: "/register/game-pass?mode=login",
    find: "/register/game-pass?mode=find",
    start: "/register/game-pass?mode=new",
    startLabel: "Start game pass",
    accent: false,
  },
];

function PathCard({ p }: { p: Path }) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 lg:p-5" aria-label={p.title}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">{p.eyebrow}</span>
          <h2 className="text-2xl">{p.title}</h2>
        </div>
        <span className="font-display text-[30px] leading-none font-extrabold">{p.price}</span>
      </div>
      <p className="text-[13.5px] text-muted">{p.body}</p>
      <div className="flex flex-col gap-2">
        <span className="text-[13.5px] font-bold">Returning player</span>
        <div className="grid grid-cols-2 gap-2">
          <ButtonLink href={p.login} variant="ghost" size="sm" className="min-h-11">
            Log in
          </ButtonLink>
          <ButtonLink href={p.find} variant="ghost" size="sm" className="min-h-11">
            Retrieve my info
          </ButtonLink>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <span className="text-[13.5px] font-bold">New player</span>
        <ButtonLink href={p.start} variant={p.accent ? "accent" : "primary"} block>
          {p.startLabel} <Icon name="right" className="size-[18px]" />
        </ButtonLink>
      </div>
    </section>
  );
}

export default async function RegisterBranchPage() {
  const season = await getActiveSeason();
  const [fee, settings] = season
    ? await Promise.all([prisma.division.aggregate({ where: { seasonId: season.id, status: "ACTIVE" }, _min: { registrationFee: true } }), getSettings(season.id)])
    : [null, null];
  const minFee = Number(fee?._min.registrationFee ?? 0);
  const gamePassFee = settings?.gamePassFee ?? 15;
  const PATHS = paths({ season: season?.name ?? "", minFee, gamePassFee });
  return (
    <>
      <AppBar title="Join NVASA" backHref="/" />
      <Screen>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[34px] lg:text-[42px]">How do you want to play?</h1>
          <p className="text-muted">Both options start the same way. Returning players can log in or look up their old profile.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {PATHS.map((p) => (
            <PathCard key={p.title} p={p} />
          ))}
        </div>
        <TableWrap>
          <DataTable className="!text-[13.5px]">
            <TableHead>
              <tr>
                <HeadCell>
                  <span className="sr-only">Compare</span>
                </HeadCell>
                <HeadCell>Season</HeadCell>
                <HeadCell>Game pass</HeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {[
                ["Matches", "All season", "One"],
                ["Team roster", "Yes", "That match only"],
                ["Review", "League office", "None"],
                ["Price", `${money(minFee)}+ by division`, money(gamePassFee)],
              ].map(([k, a, b]) => (
                <BodyRow key={k}>
                  <BodyCell className="text-muted">{k}</BodyCell>
                  <BodyCell>{a}</BodyCell>
                  <BodyCell>{b}</BodyCell>
                </BodyRow>
              ))}
            </TableBody>
          </DataTable>
        </TableWrap>
      </Screen>
    </>
  );
}
