"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

/** "Can you make it?" buttons on the next-match card. */
export function AvailabilityButtons({ onDark = true }: { onDark?: boolean }) {
  const [choice, setChoice] = useState<"yes" | "no" | null>(null);
  const [toast, showToast] = useToast();
  const pick = (v: "yes" | "no") => {
    setChoice(v);
    showToast(v === "yes" ? "You’re marked available" : "Your captain will see you can’t make it");
  };
  const cls = (on: boolean) =>
    on ? "bg-lime text-lime-ink hover:bg-lime-2" : onDark ? "bg-white/12 text-white hover:bg-white/20" : "bg-surface-2 text-fg hover:bg-surface-3";
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold" id="avail-q">
        Can you make it?
      </span>
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-labelledby="avail-q">
        <button
          type="button"
          aria-pressed={choice === "yes"}
          onClick={() => pick("yes")}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3.5 text-[13.5px] font-bold ${cls(choice === "yes")}`}
        >
          <Icon name="check" className="size-4" />
          I’m in
        </button>
        <button
          type="button"
          aria-pressed={choice === "no"}
          onClick={() => pick("no")}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3.5 text-[13.5px] font-bold ${cls(choice === "no")}`}
        >
          Can’t make it
        </button>
      </div>
      <Toast message={toast} />
    </div>
  );
}

/** Request captain access for a team the player isn't captain of. Reviewed by the league office. */
export function RequestCaptainAccess({ teamName, captainName }: { teamName: string; captainName?: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");
  const [toast, showToast] = useToast();
  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-warn">
        <Icon name="wait" className="size-4" />
        Captain request · Pending review
        <Toast message={toast} />
      </span>
    );
  }
  return (
    <>
      <Button variant="link" size="sm" className="self-start" onClick={() => setOpen(true)}>
        Request captain access
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Request captain access"
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                setSent(true);
                showToast("Request sent. Status: Pending review");
              }}
            >
              Send request
            </Button>
          </>
        }
      >
        <p className="text-muted">
          The league office reviews captain requests. You’ll stay a player on {teamName} until it’s approved
          {captainName ? `, and ${captainName} is notified` : ""}.
        </p>
        <Field label="Note for the league office" htmlFor="captain-note">
          <TextArea id="captain-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you’d like to co-captain" />
        </Field>
      </Dialog>
      <Toast message={toast} />
    </>
  );
}
