import { PageHeading } from "@/components/league";
import { Crumbs } from "../../_components/season";
import { RefereeForm } from "../forms";

export const metadata = { title: "New referee" };

export default function NewRefereePage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Referees", "/admin/referees"], ["New referee"]]} />
        <PageHeading title="New referee" />
      </div>
      <RefereeForm />
    </>
  );
}
