import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import {
  ACTIVE_SEASON,
  ALX_ROSTER,
  BLD_ROSTER,
  DEFAULT_LINEUP,
  DEFAULT_MATCH_SELECTION,
  TODAY_LABEL,
  division,
  match as sampleMatch,
  matchPool,
  team as sampleTeam,
} from "@/lib/league-data";
import { PrintButton } from "./print-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = sampleMatch(id);
  return { title: m ? `Game roster · Game #${m.id}` : "Game roster" };
}

type SheetRow = { jersey?: number | string; name: string; captain?: boolean; gamePass?: boolean; pos: string; status: string };
type SheetTeam = { name: string; ab: string; captain: string; rows: SheetRow[] };
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

const STARTERS = new Set(Object.values(DEFAULT_LINEUP));

/** Season-sample rosters for the teams we have data for. */
function sampleRows(teamId: string, matchId: number): SheetRow[] {
  if (teamId === "ffx") {
    return matchPool(matchId)
      .filter((p) => DEFAULT_MATCH_SELECTION.includes(p.jersey))
      .sort((a, b) => a.jersey - b.jersey)
      .map((p) => ({ jersey: p.jersey, name: p.name, captain: p.captain, gamePass: p.gamePass, pos: p.pos, status: STARTERS.has(p.jersey) ? "Starter" : "Sub" }));
  }
  if (teamId === "alx") return ALX_ROSTER.map((p, i) => ({ jersey: p.jersey, name: p.name, captain: i === 0, pos: p.pos, status: i < 11 ? "Starter" : "Sub" }));
  if (teamId === "bld") return BLD_ROSTER.map((p) => ({ jersey: p.jersey, name: p.name, captain: p.captain, pos: p.pos, status: "" }));
  return [];
}

function fromSample(id: string): Sheet | null {
  const m = sampleMatch(id);
  if (!m) return null;
  const side = (tid: string): SheetTeam => {
    const t = sampleTeam(tid);
    return { name: t.name, ab: t.ab, captain: t.caps[0] ?? "", rows: sampleRows(tid, m.id) };
  };
  return {
    gameNo: `#${m.id}`,
    season: ACTIVE_SEASON,
    division: division(m.div).name,
    date: `${m.date}, 2026`,
    kickoff: m.time,
    field: m.field,
    refs: m.refs,
    printed: `${TODAY_LABEL}, 2026`,
    home: side(m.home),
    away: side(m.away),
  };
}

async function fromDatabase(id: string): Promise<Sheet | null> {
  try {
    const rosterInclude = {
      division: true,
      roster: {
        where: { leftAt: null, OR: [{ membershipType: "SEASONAL" as const }, { membershipType: "GAME_PASS" as const, matchId: id }] },
        include: { player: true },
        orderBy: { joinedAt: "asc" as const },
      },
    };
    const m = await prisma.match.findUnique({
      where: { id },
      include: { season: true, homeTeam: { include: rosterInclude }, awayTeam: { include: rosterInclude } },
    });
    if (!m) return null;
    const tz = "America/New_York";
    const side = (t: typeof m.homeTeam): SheetTeam => ({
      name: t.name,
      ab: t.name
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 3)
        .toUpperCase(),
      captain: t.roster
        .filter((r) => r.isCaptain)
        .map((r) => `${r.player.firstName} ${r.player.lastName}`)
        .join(" & "),
      rows: t.roster
        .filter((r) => r.lineupStatus !== "INACTIVE")
        .map((r) => ({
          name: `${r.player.firstName} ${r.player.lastName}`,
          captain: r.isCaptain,
          gamePass: r.membershipType === "GAME_PASS",
          pos: r.player.position,
          status: r.lineupStatus === "STARTING" ? "Starter" : "Sub",
        })),
    });
    const when = m.startTime ?? m.scheduledAt;
    return {
      gameNo: `#${m.id.slice(-5).toUpperCase()}`,
      season: m.season.name,
      division: m.homeTeam.division.name,
      date: m.scheduledAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: tz }),
      kickoff: when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }),
      field: [m.location, m.field].filter(Boolean).join(" ") || "—",
      refs: ["", "", ""],
      printed: new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: tz }),
      home: side(m.homeTeam),
      away: side(m.awayTeam),
    };
  } catch {
    return null;
  }
}

function backHref(referer: string | null, id: string) {
  if (referer?.includes("/captain")) return `/captain/matches/${id}/roster`;
  if (referer?.includes("/admin")) return `/admin/matches/${id}`;
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

export default async function PrintRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/matches/${id}/print`);
  const sheet = fromSample(id) ?? (await fromDatabase(id));
  if (!sheet) notFound();
  const back = backHref((await headers()).get("referer"), id);

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

        <TeamTable title={`${sheet.home.name} (home)`} team={sheet.home} />
        <TeamTable title={`${sheet.away.name} (away)`} team={sheet.away} />

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
          <span>Printed from NVASA · {sheet.printed}</span>
          <span>Return to the referee before kickoff</span>
        </p>
      </article>
    </div>
  );
}
