import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicTopNav } from "@/components/shell/app-nav";
import { AppBar, Screen } from "@/components/shell/layout";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopNav />
      <AppBar title="Log in" backHref="/" />
      <Suspense fallback={<Screen>{null}</Screen>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
