"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Screen } from "@/components/shell/layout";

/**
 * Uses the login link's token. It runs in the browser on purpose: link scanners that open
 * emails don't run scripts, so they can't use up the single-use token.
 */
export function LinkSignIn({ token }: { token: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(!token);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    signIn("login-link", { token, redirect: false }).then((r) => {
      if (!r || r.error) setFailed(true);
      else {
        router.replace("/portal");
        router.refresh();
      }
    });
  }, [token, router]);

  return (
    <Screen>
      {failed ? (
        <>
          <Notice tone="bad" title="This login link has expired or was already used.">
            Links work once and expire after 30 minutes. Ask for a new one, or log in with your password.
          </Notice>
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink href="/retrieve" variant="primary">
              Get a new link
            </ButtonLink>
            <ButtonLink href="/login" variant="ghost">
              Log in with password
            </ButtonLink>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-5 !pt-16 text-center" role="status">
          <div className="size-[72px] animate-spin rounded-full border-[5px] border-surface-3 border-t-pitch-2" aria-hidden />
          <h1 className="text-[30px]">Logging you in</h1>
        </div>
      )}
    </Screen>
  );
}
