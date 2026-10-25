import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { Badge, MatchStatusBadge } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/card";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { db } from "@/lib/db";
import { SIZE, SURFACE, getFieldSchedule } from "@/lib/queries/fields";
import { addressLine } from "@/lib/public";
import { Crumbs } from "../../../_components/season";
import { FieldForm } from "../forms";
import { AvailabilityForm } from "./availability-form";

export const metadata = { title: "Field" };

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function FieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, parks, windows] = await Promise.all([
    getFieldSchedule(id),
    db.park.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.fieldAvailability.findMany({ where: { fieldId: id, seasonId: null }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
  ]);
  if (!data) notFound();
  const { field, label, days, upcoming, clashes } = data;
  const seasonQ = (m: { season: { name: string; isActive: boolean } }) => (m.season.isActive ? "" : `?season=${encodeURIComponent(m.season.name)}`);
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Fields", "/admin/settings/fields"], [field.park.name, `/admin/settings/fields/parks/${field.park.id}`], [label]]} />
        <PageHeading
          title={
            <span className="flex flex-wrap items-center gap-3">
              {field.park.name} · {label}
              {field.active ? null : <Badge>Inactive</Badge>}
            </span>
          }
          sub={[addressLine(field.park), SURFACE[field.surface], SIZE[field.size], field.lights ? "Lights" : "No lights"].filter(Boolean).join(" · ")}
        />
      </div>

      <AvailabilityForm
        fieldId={field.id}
        readOnly={false}
        initial={windows.map((w) => ({ weekday: w.weekday, start: hhmm(w.startMinute), end: hhmm(w.endMinute) }))}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-[26px]">Upcoming matches</h2>
        {clashes ? (
          <Notice tone="warn" title="Possible double booking">
            {clashes} matches here start within 2 hours of another one. They’re marked below.
          </Notice>
        ) : null}
        {upcoming ? (
          days.map((d) => (
            <div key={d.label} className="flex flex-col gap-2">
              <h3 className="text-[15px] font-bold">{d.label}</h3>
              <TableWrap>
                <DataTable className="text-[14px]">
                  <TableHead>
                    <tr>
                      <HeadCell>Time</HeadCell>
                      <HeadCell>Game</HeadCell>
                      <HeadCell>Match</HeadCell>
                      <HeadCell>Division</HeadCell>
                      <HeadCell>Status</HeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {d.matches.map((m) => (
                      <BodyRow key={m.id} highlight={m.clash}>
                        <BodyCell className="whitespace-nowrap">
                          <b>{m.time}</b>
                          {m.clash ? (
                            <Badge tone="warn" className="ml-2">
                              Within 2 h
                            </Badge>
                          ) : null}
                        </BodyCell>
                        <BodyCell className="font-mono">
                          <RowLink href={`/admin/matches/${m.gameNumber}${seasonQ(m)}`}>#{m.gameNumber}</RowLink>
                        </BodyCell>
                        <BodyCell className="whitespace-nowrap">
                          {m.homeTeam.name} <span className="text-muted">vs</span> {m.awayTeam.name}
                        </BodyCell>
                        <BodyCell className="text-[13px]">{m.division?.name ?? "—"}</BodyCell>
                        <BodyCell>
                          <MatchStatusBadge status={m.status} />
                        </BodyCell>
                      </BodyRow>
                    ))}
                  </TableBody>
                </DataTable>
              </TableWrap>
            </div>
          ))
        ) : (
          <EmptyState icon="cal" title="Nothing scheduled here" />
        )}
        <p className="text-[13px] text-muted">
          {field._count.matches} match{field._count.matches === 1 ? "" : "es"} in all, past ones included.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[26px]">Details</h2>
        <FieldForm
          parks={parks}
          field={{ id: field.id, parkId: field.parkId, name: field.name, surface: field.surface, lights: field.lights, size: field.size, active: field.active, notes: field.notes ?? "" }}
        />
      </section>
    </>
  );
}
