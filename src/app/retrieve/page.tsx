import type { Metadata } from "next";
import { PublicTopNav } from "@/components/shell/app-nav";
import { AppBar } from "@/components/shell/layout";
import { RetrieveForm } from "./retrieve-form";

export const metadata: Metadata = { title: "Find my player info" };

export default function RetrievePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopNav />
      <AppBar title="Find my player info" backHref="/login" />
      <RetrieveForm />
    </div>
  );
}
