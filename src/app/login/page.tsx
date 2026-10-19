import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicTopNav } from "@/components/shell/app-nav";
import { AppBar, Screen } from "@/components/shell/layout";
import { LoginForm } from "./login-form";
import { getBrand } from "@/lib/branding";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  // On the platform host (no league) there are no league pages to link to
  const platform = !(await getBrand()).orgId;
  return (
    <div className="flex min-h-screen flex-col">
      {platform ? null : <PublicTopNav />}
      <AppBar title="Log in" backHref="/" />
      <Suspense fallback={<Screen>{null}</Screen>}>
        <LoginForm platform={platform} />
      </Suspense>
    </div>
  );
}
