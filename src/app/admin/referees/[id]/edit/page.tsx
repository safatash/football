import { notFound } from "next/navigation";
import { PageHeading } from "@/components/league";
import { db } from "@/lib/db";
import { Crumbs } from "../../../_components/season";
import { RefereeForm } from "../../forms";

export const metadata = { title: "Edit referee" };

export default async function EditRefereePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await db.referee.findUnique({ where: { id } });
  if (!r) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <Crumbs items={[["Referees", "/admin/referees"], [r.name, `/admin/referees/${r.id}`], ["Edit"]]} />
        <PageHeading title={`Edit ${r.name}`} />
      </div>
      <RefereeForm
        referee={{
          id: r.id,
          name: r.name,
          email: r.email ?? "",
          phone: r.phone ?? "",
          certLevel: r.certLevel ?? "",
          certExpires: r.certExpires ? r.certExpires.toISOString().slice(0, 10) : "",
          center: r.positions.includes("CENTER"),
          assistant: r.positions.includes("ASSISTANT"),
          active: r.active,
          notes: r.notes ?? "",
        }}
      />
    </>
  );
}
