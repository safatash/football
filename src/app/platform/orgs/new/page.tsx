import { PageHeading } from "@/components/league";
import { NewOrgForm } from "../../controls";

export const metadata = { title: "New league" };

export default function NewOrgPage() {
  return (
    <>
      <PageHeading title="New league" sub="Manual onboarding for pilot leagues. The owner gets an email to set a password." />
      <NewOrgForm />
    </>
  );
}
