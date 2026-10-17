import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import prisma from "@/lib/prisma";
import { PageHeading } from "@/components/league";
import { Badge, PaymentBadge, RegistrationBadge } from "@/components/ui/badge";
import { Card, CardHeader, KeyValue, Notice } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BLOCKLIST, EXTRA_ZIPS, PLACEMENTS, REGISTRATIONS, TEAMS, ageOn, division, looksEligibleZip, money } from "@/lib/league-data";
import { ArchivedNotice, Crumbs, isArchived, seasonFrom, withSeason, type SearchParams } from "../../_components/season";
import { parseList, shortDate, teamLookup } from "../../_components/registration-data";
import { ApproveRegistrationForm, type DecisionReg, type TeamGroup } from "./approve-form";

export const metadata = { title: "Registration" };

type Check = [ok: boolean, text: string];

type View = {
  id: string;
  name: string;
  email: string;
  submitted: string;
  status: string;
  payment: string;
  checks: Check[];
  application: [string, ReactNode][];
  captain: { teams: string; note?: string; captains: string } | null;
  denyNote?: string;
  decision: DecisionReg;
  teams: TeamGroup[];
  defaultTeamId: string;
  mode: "api" | "local";
};

const fmtDob = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const blocked = (email: string, list: string[]) => {
  const e = email.toLowerCase();
  const domain = e.split("@")[1] ?? "";
  return list.some((b) => {
    const x = b.toLowerCase();
    return x === e || x === domain || x === `*@${domain}`;
  });
};

function sampleView(id: string): View | null {
  const r = REGISTRATIONS.find((x) => x.id === id);
  if (!r) return null;
  const d = division(r.div);
  const age = ageOn(r.dob);
  const zipOk = looksEligibleZip(r.zip) || EXTRA_ZIPS.includes(r.zip);
  const prefTeam = TEAMS.find((t) => t.name === r.pref);
  const paid = r.pay === "Paid";
  const open = r.reg === "Submitted" || r.reg === "Pending Review";
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    submitted: r.date,
    status: r.reg,
    payment: r.pay,
    checks: [
      [age !== null && age >= 18, `Age ${age ?? "unknown"} on opening day · eligible for ${d.name}`],
      [zipOk, zipOk ? `ZIP ${r.zip} is in the eligible area` : `ZIP ${r.zip} (${r.city}) is outside Fairfax County and eligible ZIPs`],
      [!blocked(r.email, BLOCKLIST), blocked(r.email, BLOCKLIST) ? "Email is on the blocklist" : "Email not on the blocklist"],
      [paid, paid ? `Payment received · ${money(r.amount)}` : `Payment ${r.pay.toLowerCase()} · ${money(r.amount)} due`],
    ],
    application: [
      ["Division", `${d.name} · ${money(d.fee)}`],
      ["Date of birth", fmtDob(r.dob)],
      ["Home", `${r.city}, VA ${r.zip}`],
      ["Background", `${r.isNew ? "New to NVASA" : "Returning player"} · ${r.level}`],
      ["Preferred team", r.pref],
      ["Backup team", r.backup],
    ],
    captain: r.captainRequest ? { teams: r.pref, note: r.captainNote, captains: prefTeam?.caps.join(", ") || "—" } : null,
    denyNote: r.denyNote,
    decision: {
      id: r.id,
      name: r.name,
      email: r.email,
      status: open ? "open" : r.reg === "Approved" ? "approved" : "denied",
      payment: r.pay.toLowerCase(),
      paid,
      amount: money(r.amount),
      divisionName: d.name,
      captainRequested: r.captainRequest,
      hasPreference: r.pref !== "—",
    },
    teams: [{ label: d.name, options: TEAMS.filter((t) => t.div === r.div).map((t) => ({ id: t.id, name: t.name, label: `${t.name} · ${t.size} players` })) }],
    defaultTeamId: prefTeam?.id ?? PLACEMENTS.find((p) => p.id === r.id)?.rec.team ?? "",
    mode: "local",
  };
}

async function dbView(id: string): Promise<View | null> {
  const reg = await prisma.registration.findUnique({
    where: { id },
    include: { player: { include: { user: { select: { email: true } } } }, season: true },
  });
  if (!reg) return null;
  const p = reg.player;
  const email = p.user.email;
  const name = `${p.firstName} ${p.lastName}`.trim();
  const picks = parseList(reg.selectedTeams);
  const capPicks = parseList(reg.captainRequests);

  const [teams, lookup] = await Promise.all([
    prisma.team
      .findMany({
        where: { seasonId: reg.seasonId, status: "ACTIVE" },
        include: {
          division: true,
          _count: { select: { roster: { where: { leftAt: null, membershipType: "SEASONAL" } } } },
          roster: { where: { isCaptain: true, leftAt: null }, include: { player: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: [{ division: { displayOrder: "asc" } }, { name: "asc" }],
      })
      .catch(() => []),
    teamLookup([...picks, ...capPicks]).catch(() => new Map<string, { id: string; name: string; division: { name: string } }>()),
  ]);

  const nameOf = (v: string) => lookup.get(v)?.name ?? v;
  const preferred = picks[0] ? lookup.get(picks[0]) : undefined;
  const divisionName = preferred?.division.name ?? null;
  const divisionRow = preferred ? teams.find((t) => t.id === preferred.id)?.division : undefined;

  // Eligibility
  const dobIso = p.dob.toISOString().slice(0, 10);
  const age = ageOn(dobIso);
  let zipOk = p.fairfaxCounty;
  if (!zipOk) {
    try {
      zipOk = !!(await prisma.allowedZipCode.findUnique({ where: { zipCode: p.zip.trim() } }));
    } catch {
      zipOk = looksEligibleZip(p.zip);
    }
  }
  const domain = email.toLowerCase().split("@")[1] ?? "";
  let blockCheck: Check;
  try {
    const hit = await prisma.blocklist.findFirst({
      where: { email: { in: [email, email.toLowerCase(), domain, `*@${domain}`], mode: "insensitive" } },
    });
    blockCheck = hit ? [false, `Email is on the blocklist${hit.reason ? ` · ${hit.reason}` : ""}`] : [true, "Email not on the blocklist"];
  } catch {
    blockCheck = [false, "Blocklist couldn’t be checked"];
  }
  const amount = money(Number(reg.totalAmount.toString()));
  const paid = reg.paymentStatus === "PAID";

  const capTeamNames = capPicks.map(nameOf);
  const capTeams = teams.filter((t) => capPicks.includes(t.id) || capPicks.includes(t.name));
  const currentCaps = capTeams.flatMap((t) => t.roster.map((r) => `${r.player.firstName} ${r.player.lastName}`));

  const groups = new Map<string, TeamGroup>();
  for (const t of teams) {
    const g = groups.get(t.division.name) ?? { label: t.division.name, options: [] };
    g.options.push({ id: t.id, name: t.name, label: `${t.name} · ${t._count.roster}/${t.maxPlayers}` });
    groups.set(t.division.name, g);
  }
  const defaultTeam = picks.map((v) => teams.find((t) => t.id === v || t.name === v)).find(Boolean);

  return {
    id: reg.id,
    name,
    email,
    submitted: shortDate(reg.submittedAt),
    status: reg.status,
    payment: reg.paymentStatus,
    checks: [
      [age !== null && age >= 18, `Age ${age ?? "unknown"} on opening day${divisionName ? ` · ${divisionName}` : ""}`],
      [zipOk, zipOk ? `ZIP ${p.zip} is in the eligible area` : `ZIP ${p.zip} (${p.city}) is outside Fairfax County and eligible ZIPs`],
      blockCheck,
      [paid, paid ? `Payment received · ${amount}` : `Payment ${reg.paymentStatus.toLowerCase()} · ${amount} due`],
    ],
    application: [
      ["Season", reg.season.name],
      ["Division", divisionName ? `${divisionName}${divisionRow ? ` · ${money(Number(divisionRow.registrationFee.toString()))}` : ""}` : "—"],
      ["Date of birth", fmtDob(dobIso)],
      ["Gender", p.gender === "FEMALE" ? "Female" : "Male"],
      ["Phone", p.phone || "—"],
      ["Home", [p.address, `${p.city}, ${p.state} ${p.zip}`].filter(Boolean).join(", ")],
      [
        "Background",
        `${reg.registrationType === "NEW_PLAYER" ? "New to NVASA" : reg.registrationType === "RETURNING_PLAYER" ? "Returning player" : "Additional team"} · ${p.position || "No position given"}`,
      ],
      ["T-shirt", p.tshirtSize || "—"],
      ["Preferred team", picks[0] ? nameOf(picks[0]) : "—"],
      ["Backup team", picks[1] ? nameOf(picks[1]) : "—"],
      ["Amount", amount],
    ],
    captain: capPicks.length ? { teams: capTeamNames.join(", "), captains: currentCaps.join(", ") || "—" } : null,
    decision: {
      id: reg.id,
      name,
      email,
      status: reg.status === "PENDING" ? "open" : reg.status === "APPROVED" ? "approved" : reg.status === "REJECTED" ? "denied" : "cancelled",
      payment: paid ? "paid" : reg.paymentStatus === "FAILED" ? "failed" : reg.paymentStatus.toLowerCase(),
      paid,
      amount,
      divisionName,
      captainRequested: capPicks.length > 0,
      hasPreference: picks.length > 0,
    },
    teams: [...groups.values()],
    defaultTeamId: defaultTeam?.id ?? "",
    mode: "api",
  };
}

export default async function RegistrationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const season = seasonFrom(await searchParams);
  const v = /^R-\d+$/.test(id) ? sampleView(id) : await dbView(id);
  if (!v) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Registrations", withSeason("/admin/registrations", season)], [v.name]]} />
        <PageHeading
          title={v.name}
          sub={
            <>
              <span className="font-mono text-[13px]">{v.mode === "api" ? v.id.slice(-8).toUpperCase() : v.id}</span> · submitted {v.submitted} · {v.email}
            </>
          }
          actions={
            <>
              <RegistrationBadge status={v.status} />
              <PaymentBadge status={v.payment} />
            </>
          }
        />
      </div>
      <ArchivedNotice season={season} />

      <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <Card>
            <CardHeader title="Eligibility checks" />
            <ul className="flex flex-col gap-2.5">
              {v.checks.map(([ok, text], i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Icon name={ok ? "check" : "alert"} className={`mt-0.5 size-[18px] shrink-0 ${ok ? "text-ok" : "text-warn"}`} />
                  <span className={`text-sm ${ok ? "" : "font-bold"}`}>{text}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Application" />
            <KeyValue items={v.application} />
          </Card>

          {v.captain ? (
            <Card className="border-pass">
              <CardHeader title="Captain request" action={<Badge tone="pass">Needs decision</Badge>} />
              {v.captain.note ? <p>“{v.captain.note}”</p> : <p>Asked for captain access on {v.captain.teams}.</p>}
              <p className="mt-2 text-[13px] text-muted">
                Current captain of {v.captain.teams}: {v.captain.captains}
              </p>
            </Card>
          ) : null}

          {v.denyNote ? (
            <Notice tone="bad" icon="x" title="Denied:">
              {v.denyNote}
            </Notice>
          ) : null}
        </div>

        <div className="min-w-0">
          <ApproveRegistrationForm mode={v.mode} registration={v.decision} teams={v.teams} defaultTeamId={v.defaultTeamId} readOnly={isArchived(season)} />
        </div>
      </div>
    </>
  );
}
