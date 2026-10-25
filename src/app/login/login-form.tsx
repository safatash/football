"use client";

import { useBrand } from "@/components/brand";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { Screen } from "@/components/shell/layout";

export function LoginForm({ platform = false }: { platform?: boolean }) {
  const brand = useBrand();
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/portal";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error) {
        setError(result?.error === "RATE_LIMITED" ? "Too many sign-in attempts. Wait a few minutes and try again." : "That email and password don’t match our records.");
        setLoading(false);
      } else {
        router.push(next);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Screen>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[34px] lg:text-[42px]">Welcome back</h1>
        <p className="text-muted">Log in to see your teams, matches and registrations.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Field label="Email" htmlFor="le">
          <TextInput
            id="le"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="lp" className="text-[13.5px] font-bold">
              Password
            </label>
            <Link href="/login/forgot" className="text-[13.5px] font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
              Forgot password?
            </Link>
          </div>
          <TextInput
            id="lp"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <Button type="submit" variant="primary" block disabled={loading || !email || !password}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>

      {platform ? (
        <p className="text-center text-[13.5px] text-muted">
          Running a league?{" "}
          <Link href="/signup" className="font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
            Start one
          </Link>
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface-2 p-4">
            <b>Can’t remember which email you used?</b>
            <p className="text-[13.5px] text-muted">
              Look yourself up with your date of birth and we’ll send a login link to the email on file.
            </p>
            <ButtonLink href="/retrieve" variant="ghost" size="sm" className="self-start">
              Retrieve my player info
            </ButtonLink>
          </div>

          <p className="text-center text-[13.5px] text-muted">
            New to {brand.name}?{" "}
            <Link href="/register" className="font-bold text-pitch-2 underline underline-offset-4 dark:text-lime">
              Create an account
            </Link>
          </p>
        </>
      )}
    </Screen>
  );
}
