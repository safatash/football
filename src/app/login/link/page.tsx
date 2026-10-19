import type { Metadata } from "next";
import { PublicTopNav } from "@/components/shell/app-nav";
import { AppBar } from "@/components/shell/layout";
import { LinkSignIn } from "./link-sign-in";

export const metadata: Metadata = { title: "Logging you in" };

export default async function LoginLinkPage({ searchParams }: { searchParams: Promise<{ token?: string; next?: string }> }) {
  const { token, next } = await searchParams;
  // Only paths on this site (no //host or schemes)
  const to = next && /^\/(?!\/)[\w\-/?=&.]*$/.test(next) ? next : "/portal";
  return (
    <div className="flex min-h-screen flex-col">
      <PublicTopNav />
      <AppBar title="Log in" backHref="/" />
      <LinkSignIn token={token ?? ""} next={to} />
    </div>
  );
}
