import type { Metadata } from "next";
import { PublicTopNav } from "@/components/shell/app-nav";
import { AppBar } from "@/components/shell/layout";
import { LinkSignIn } from "./link-sign-in";

export const metadata: Metadata = { title: "Logging you in" };

export default async function LoginLinkPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopNav />
      <AppBar title="Log in" backHref="/" />
      <LinkSignIn token={token ?? ""} />
    </div>
  );
}
