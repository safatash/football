"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/controls";
import { Field, TextInput } from "@/components/ui/field";
import { clearDemoData } from "@/lib/actions/demo";
import { CLEAR_DEMO_PHRASE } from "@/lib/demo";

/** Settings › Demo data: what's left from the seed, and a typed-confirmation delete. */
export function DemoData({ teams, matches, players, parks }: { teams: number; matches: number; players: number; parks: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [pending, start] = useTransition();
  const any = teams + matches + players + parks > 0;
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 id="demo-data" className="scroll-mt-24 text-[26px]">
        Demo data
      </h2>
      {done ? <Notice tone="ok">{done}.</Notice> : null}
      {any ? (
        <>
          <p className="text-muted">
            The seed added sample teams, matches, players (all @example.com accounts) and parks so the site has something to show. They’re marked <b>Demo</b> everywhere. Clearing removes {teams} teams, {matches}{" "}
            matches, {players} players and {parks} parks (with their fields), plus rosters, reports, registrations, game passes and payments. Divisions, settings and league-office accounts stay.
          </p>
          <div>
            <Button variant="danger" onClick={() => (setTyped(""), setError(""), setOpen(true))}>
              Clear demo data
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted">No demo data left. Everything here was entered by the league office or by players.</p>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Clear demo data?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={pending || typed.trim().toLowerCase() !== CLEAR_DEMO_PHRASE}
              onClick={() =>
                start(async () => {
                  const res = await clearDemoData({ confirm: typed });
                  if (!res.ok) return setError(res.error);
                  setOpen(false);
                  setDone(res.message);
                  router.refresh();
                })
              }
            >
              {pending ? "Clearing…" : "Clear demo data"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <p className="text-muted">This permanently deletes the sample teams, matches and players. It can’t be undone.</p>
          <Field label={`Type “${CLEAR_DEMO_PHRASE}” to confirm`} htmlFor="demo-confirm">
            <TextInput id="demo-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
