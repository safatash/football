import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { getPark } from "@/lib/queries/fields";
import { Crumbs } from "../../../../_components/season";
import { ParkForm } from "../../forms";

export const metadata = { title: "Edit park" };

export default async function EditParkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const park = await getPark(id);
  if (!park) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Fields", "/admin/settings/fields"], [park.name]]} />
        <PageHeading title={`Edit ${park.name}`} sub={`${park.fields.length} field${park.fields.length === 1 ? "" : "s"}. Edit each field from the Fields list.`} />
      </div>
      <ParkForm
        park={{
          id: park.id,
          name: park.name,
          address: park.address ?? "",
          city: park.city ?? "",
          state: (["VA", "MD", "DC"].includes(park.state ?? "") ? park.state : "VA") as "VA" | "MD" | "DC",
          zip: park.zip ?? "",
          mapUrl: park.mapUrl ?? "",
          notes: park.notes ?? "",
        }}
      />
    </>
  );
}
