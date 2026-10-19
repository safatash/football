import { appName } from "@/lib/branding";
import { rootDomain } from "@/lib/tenant";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Start your league" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center gap-5 px-4 py-10">
      <span className="font-display text-2xl font-extrabold">{appName()}</span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] leading-tight">Start your league</h1>
        <p className="text-muted">Registration, rosters, schedules, standings and payments in one place. Free for 30 days.</p>
      </div>
      <SignupForm domain={rootDomain()} />
    </main>
  );
}
