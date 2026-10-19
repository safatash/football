import { PageHeading } from "@/components/league";
import { Notice } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { Crumbs, param, type SearchParams } from "../../../_components/season";
import { FieldForm } from "../forms";

export const metadata = { title: "Add field" };

export default async function NewFieldPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parks = await prisma.park.findMany({ select: { id: true, name: true, _count: { select: { fields: true } } }, orderBy: { name: "asc" } });
  const park = parks.find((p) => p.id === param(sp.park)) ?? parks[0];
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Fields", "/admin/settings/fields"], ["Add field"]]} />
        <PageHeading title="Add field" sub={park ? `To ${park.name}` : undefined} />
      </div>
      {park ? (
        <FieldForm
          parks={parks.map((p) => ({ id: p.id, name: p.name }))}
          field={{ parkId: park.id, name: String(park._count.fields + 1), surface: "GRASS", lights: false, size: "FULL", active: true, notes: "" }}
        />
      ) : (
        <Notice tone="info">Add a park first.</Notice>
      )}
    </>
  );
}
