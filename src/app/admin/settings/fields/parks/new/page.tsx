import { PageHeading } from "@/components/league";
import { Crumbs } from "../../../../_components/season";
import { ParkForm } from "../../forms";

export const metadata = { title: "New park" };

export default function NewParkPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Fields", "/admin/settings/fields"], ["New park"]]} />
        <PageHeading title="New park" sub="The address is shared by all of its fields." />
      </div>
      <ParkForm />
    </>
  );
}
