import type { Metadata } from "next";
import { PublicTopNav } from "@/components/shell/app-nav";
import { AppBar } from "@/components/shell/layout";
import { peekToken } from "@/lib/tokens";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await peekToken("reset", token);
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopNav />
      <AppBar title="Reset password" backHref="/login" />
      <ResetForm token={token} valid={valid} />
    </div>
  );
}
