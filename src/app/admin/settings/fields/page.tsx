import Link from "next/link";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, RowLink, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { SIZE, SURFACE, listParks } from "@/lib/queries/fields";
import { DemoBadge } from "../../_components/demo";
import { DoneNotice } from "../../_components/done-notice";
import { param, type SearchParams } from "../../_components/season";

export const metadata = { title: "Fields" };

export default async function FieldsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parks = await listParks();
  const fieldCount = parks.reduce((a, p) => a + p.fields.length, 0);
  return (
    <>
      <PageHeading
        title="Fields"
        sub={`${parks.length} parks · ${fieldCount} fields. Inactive fields stay on past matches but can’t be scheduled.`}
        actions={
          <ButtonLink href="/admin/settings/fields/parks/new" variant="primary" size="sm">
            <Icon name="plus" className="size-4" />
            New park
          </ButtonLink>
        }
      />
      <DoneNotice done={param(sp.done)} what={param(sp.what)} />
      {parks.length ? (
        <div className="flex flex-col gap-5">
          {parks.map((p) => (
            <Card key={p.id} as="section" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="flex flex-wrap items-center gap-2 text-[22px]">
                    {[p.name, p.city].filter(Boolean).join(" · ")}
                    {p.isDemo ? <DemoBadge /> : null}
                  </h2>
                  <span className="text-[13.5px] text-muted">{p.addressLine || "No address yet"}</span>
                  {p.notes ? <span className="text-[13px] text-muted">Parking: {p.notes}</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/admin/settings/fields/parks/${p.id}`} variant="ghost" size="sm">
                    <Icon name="edit" className="size-4" />
                    Edit park
                  </ButtonLink>
                  <ButtonLink href={`/admin/settings/fields/new?park=${p.id}`} variant="ghost" size="sm">
                    <Icon name="plus" className="size-4" />
                    Add field to this park
                  </ButtonLink>
                </div>
              </div>
              {p.fields.length ? (
                <TableWrap>
                  <DataTable className="text-[14px]">
                    <caption className="sr-only">{`${p.name} fields`}</caption>
                    <TableHead>
                      <tr>
                        <HeadCell>Field</HeadCell>
                        <HeadCell>Address</HeadCell>
                        <HeadCell>Status</HeadCell>
                        <HeadCell align="right">Upcoming matches</HeadCell>
                      </tr>
                    </TableHead>
                    <TableBody>
                      {p.fields.map((f) => (
                        <BodyRow key={f.id}>
                          <BodyCell className="whitespace-nowrap">
                            <RowLink href={`/admin/settings/fields/${f.id}`}>{f.label}</RowLink>
                            <div className="text-xs text-muted">{[SURFACE[f.surface], SIZE[f.size], f.lights ? "Lights" : null].filter(Boolean).join(" · ")}</div>
                          </BodyCell>
                          <BodyCell className="text-[13px] text-muted">{p.addressLine || "—"}</BodyCell>
                          <BodyCell>{f.active ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>}</BodyCell>
                          <BodyCell align="right">
                            <Link href={`/admin/settings/fields/${f.id}`} className="font-bold underline-offset-4 hover:underline">
                              {f.upcoming}
                            </Link>
                          </BodyCell>
                        </BodyRow>
                      ))}
                    </TableBody>
                  </DataTable>
                </TableWrap>
              ) : (
                <p className="text-[13.5px] text-muted">No fields yet.</p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="pin"
          title="No parks yet"
          action={
            <ButtonLink href="/admin/settings/fields/parks/new" variant="primary" size="sm">
              New park
            </ButtonLink>
          }
        >
          Add a park and its fields so matches can be scheduled.
        </EmptyState>
      )}
    </>
  );
}
