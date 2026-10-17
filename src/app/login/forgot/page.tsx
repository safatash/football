import type { Metadata } from "next";
import { PublicTopNav } from "@/components/shell/app-nav";
import { AppBar } from "@/components/shell/layout";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopNav />
      <AppBar title="Reset password" backHref="/login" />
      <ForgotForm />
    </div>
  );
}
