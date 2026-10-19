import { getBrand } from "@/lib/branding";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { now } from "@/lib/clock";
import { TZ } from "@/lib/format";
import { matchRosterPlayers, posCode, seasonName } from "@/lib/queries/captain";
import { findMatch, type MatchView } from "@/lib/queries/matches";
import { getActiveSeason } from "@/lib/queries/season";
import { matchPool } from "@/lib/queries/teams";
import { requireUser } from "@/lib/session";
import { getTeamAccess } from "@/lib/team-access";
import { PrintButton } from "./print-button";

export async function generateMetadata({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  return { title: /^\d+$/.test(matchId) ? `Game roster · Game #${matchId}` : "Game roster" };
}

type SheetRow = { jersey?: number | string; name: string; captain?: boolean; gamePass?: boolean; pos: string; status: string };
type SheetTeam = { name: string; ab: string; captain: string; rows: SheetRow[]; label: string };
type Sheet = {
  gameNo: string;
  season: string;
  division: string;
  date: string;
  kickoff: string;
  field: string;
  refs: [string, string, string];
  printed: string;
  home: SheetTeam;
  away: SheetTeam;
};

const sheetDate = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: TZ });
const byJersey = (a: SheetRow, b: SheetRow) => (Number(a.jersey) || 999) - (Number(b.jersey) || 999) || a.name.localeCompare(b.name);

/** Finalized match roster if there is one, else the draft, else the season roster plus this match's game passes. */
async function side(team: MatchView["homeTeam"], matchId: string): Promise<SheetTeam> {
  const [mr, pool] = await Promise.all([matchRosterPlayers(matchId, team.id), matchPool(team.id, matchId)]);
  const captain = pool
    .filter((p) => p.isCaptain && !p.gamePass)
    .map((p) => p.name)
    .join(" & ");
  const ab = (team.shortName ?? team.name.split(/\s+/).map((w) => w[0]).join("")).slice(0, 3).toUpperCase();
  const rows: SheetRow[] = mr?.players.length
    ? mr.players.map((p) => ({ jersey: p.jersey ?? undefined, name: p.name, captain: p.captain, gamePass: p.gamePass, pos: p.pos, status: p.starter ? "Starter" : "Sub" }))
    : pool.map((p) => ({ jersey: p.jerseyNumber ?? undefined, name: p.name, captain: p.isCaptain, gamePass: p.gamePass, pos: posCode(p.player.position), status: "" }));
  const label = !mr?.players.length ? " · season roster" : mr.status === "DRAFT" ? " · draft, not finalized" : "";
  return { name: team.name, ab, captain, rows: rows.sort(byJersey), label };
}

function backHref(referer: string | null, gameNumber: number) {
  const captainTeam = referer?.match(/\/captain\/([^/?#]+)/)?.[1];
  if (captainTeam) return `/captain/${captainTeam}/matches/${gameNumber}/roster`;
  if (referer?.includes("/admin")) return `/admin/matches/${gameNumber}`;
  return "/portal";
}

const BLANK_ROWS = 16;

function TeamTable({ title, team }: { title: string; team: SheetTeam }) {
  // Teams without a roster on file get blank lines to fill in by hand.
  const blanks = team.rows.length ? 0 : BLANK_ROWS;
  return (
    <div>
      <h3 className="mt-[18px] text-lg text-black">{title}</h3>
      <div className="overflow-x-auto">
        <table className="mt-3.5 w-full min-w-[520px] border-collapse [&_td]:border [&_td]:border-black [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-black [&_th]:bg-[#ececec] [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-[10px] [&_th]:tracking-[0.1em] [&_th]:uppercase">
          <thead>
            <tr>
              <th className="w-11">#</th>
              <th>Player</th>
              <th className="w-[52px]">Pos</th>
              <th className="w-[110px]">Status</th>
              <th className="w-11">G</th>
              <th className="w-11">Card</th>
            </tr>
          </thead>
          <tbody>
            {team.rows.map((r, i) => (
              <tr key={`${r.name}-${i}`}>
                <td>
                  <b>{r.jersey ?? ""}</b>
                </td>
                <td>
                  {r.name}
                  {r.captain ? " (C)" : ""}{" "}
                  {r.gamePass ? <span className="border-[1.5px] border-black px-[5px] py-px text-[10px] font-extrabold tracking-[0.06em]">GP · THIS MATCH ONLY</span> : null}
                </td>
                <td>{r.pos}</td>
                <td>{r.status}</td>
                <td />
                <td />
              </tr>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <tr key={`blank-${i}`} className="h-[31px]">
                <td />
                <td />
                <td />
                <td />
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function PrintRosterPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId: gameNumber } = await params;
  await requireUser(`/matches/${gameNumber}/print`);
  const season = await getActiveSeason();
  const m = season ? await findMatch(gameNumber, season.id) : null;
  if (!m) notFound();
  const [home, away] = await Promise.all([getTeamAccess(m.homeTeam.id), getTeamAccess(m.awayTeam.id)]);
  if (!home.access && !away.access) notFound();

  const [homeSide, awaySide, seasonLabel] = await Promise.all([side(m.homeTeam, m.id), side(m.awayTeam, m.id), seasonName(m.seasonId)]);
  const sheet: Sheet = {
    gameNo: `#${m.gameNumber}`,
    season: seasonLabel,
    division: m.division?.name ?? m.homeTeam.division.name,
    date: sheetDate(m.scheduledAt),
    kickoff: m.time,
    field: m.field || "—",
    refs: m.refs,
    printed: sheetDate(now()),
    home: homeSide,
    away: awaySide,
  };
  const back = backHref((await headers()).get("referer"), m.gameNumber);

  return (
    <div className="flex min-h-screen flex-col items-center gap-3.5 bg-surface-2 px-4 pt-6 pb-16 print:bg-white print:p-0">
      <div className="no-print flex w-full max-w-[816px] flex-wrap items-center justify-between gap-2.5">
        <ButtonLink href={back} variant="ghost" size="sm">
          <Icon name="left" className="size-4" />
          Back
        </ButtonLink>
        <span className="text-sm text-muted">Letter · black &amp; white</span>
        <PrintButton />
      </div>

      <article aria-label="Printable game roster" className="print-sheet w-full max-w-[816px] bg-white px-5 py-7 text-[13px] text-black shadow-[0_10px_40px_rgba(0,0,0,.18)] sm:px-12 sm:py-11">
        <div className="flex items-start justify-between gap-4 border-b-[3px] border-black pb-3">
          <div>
            <div className="text-[11px] font-bold tracking-[0.14em]">NORTHERN VIRGINIA ADULT SOCCER ASSOCIATION</div>
            <h1 className="text-[30px] tracking-[0.02em] text-black uppercase">Official game roster</h1>
            <div className="mt-1 text-xs">
              {sheet.season} · {sheet.division}
            </div>
          </div>
          <div className="shrink-0 border-[3px] border-black px-3 py-1.5 text-center font-display text-[44px] leading-[.9] font-extrabold">
            <small className="block font-sans text-[11px] tracking-[0.12em]">GAME</small>
            {sheet.gameNo}
          </div>
        </div>

        <div className="grid grid-cols-2 border-[1.5px] border-t-0 border-black sm:grid-cols-4 print:grid-cols-4 [&>div]:border-r [&>div]:border-b [&>div]:border-black [&>div]:px-2.5 [&>div]:py-2 sm:[&>div]:border-b-0 print:[&>div]:border-b-0 [&>div:last-child]:border-r-0 [&_b]:block [&_b]:text-[10px] [&_b]:tracking-[0.1em] [&_b]:uppercase">
          <div>
            <b>Date</b>
            {sheet.date}
          </div>
          <div>
            <b>Kickoff</b>
            {sheet.kickoff}
          </div>
          <div>
            <b>Field</b>
            {sheet.field}
          </div>
          <div>
            <b>Home / Away</b>
            {sheet.home.ab} / {sheet.away.ab}
          </div>
        </div>
        <div className="grid grid-cols-1 border-[1.5px] border-t-0 border-black sm:grid-cols-3 print:grid-cols-3 [&>div]:border-b [&>div]:border-black [&>div]:px-2.5 [&>div]:py-2 sm:[&>div]:border-r sm:[&>div]:border-b-0 print:[&>div]:border-r print:[&>div]:border-b-0 [&>div:last-child]:border-0 [&_b]:block [&_b]:text-[10px] [&_b]:tracking-[0.1em] [&_b]:uppercase">
          <div>
            <b>Referee</b>
            {sheet.refs[0] || "—"}
          </div>
          <div>
            <b>Assistant ref 1</b>
            {sheet.refs[1] || "—"}
          </div>
          <div>
            <b>Assistant ref 2</b>
            {sheet.refs[2] || "—"}
          </div>
        </div>

        <TeamTable title={`${sheet.home.name} (home)${sheet.home.label}`} team={sheet.home} />
        <TeamTable title={`${sheet.away.name} (away)${sheet.away.label}`} team={sheet.away} />

        <p className="mt-2.5 text-[11px]">
          <b>GP</b> = single-match game pass. Valid for Game {sheet.gameNo} only; not part of the season roster.
        </p>
        <div className="mt-3.5 border-[1.5px] border-black px-2.5 py-2 text-xs">
          <b>Final score</b> &nbsp; {sheet.home.ab} ______ &nbsp; {sheet.away.ab} ______ &nbsp;&nbsp; <b>Notes / incidents</b> ____________________________________________
        </div>
        <div className="mt-7 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2 print:grid-cols-2 [&>div]:border-t-[1.5px] [&>div]:border-black [&>div]:pt-1 [&>div]:text-[11px]">
          <div>Home captain{sheet.home.captain ? ` · ${sheet.home.captain}` : ""}</div>
          <div>Away captain{sheet.away.captain ? ` · ${sheet.away.captain}` : ""}</div>
          <div>Referee{sheet.refs[0] ? ` · ${sheet.refs[0]}` : ""}</div>
          <div>Date &amp; time signed</div>
        </div>
        <p className="mt-6 flex flex-wrap justify-between gap-2 text-[10px]">
          <span>Printed from {(await getBrand()).name} · {sheet.printed}</span>
          <span>Return to the referee before kickoff</span>
        </p>
      </article>
    </div>
  );
}
