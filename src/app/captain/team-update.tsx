"use client";

import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";

const DEFAULT_MESSAGE =
  "Wakefield Park 3 tomorrow, 9:00 kickoff. Please be there by 8:30 in green. Bring water — it’s going to be hot.";

/** "Send a team update" button + dialog. Messages go to season players and this match's game-pass players. */
export function TeamUpdateButton({
  label = "Send a team update",
  variant = "ghost",
  size = "md",
  block,
  recipients = 19,
}: {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  recipients?: number;
}) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(DEFAULT_MESSAGE);
  const [toast, showToast] = useToast();
  return (
    <>
      <Button variant={variant} size={size} block={block} onClick={() => setOpen(true)}>
        <Icon name="send" className="size-4" />
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Send a team update"
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!msg.trim()}
              onClick={() => {
                setOpen(false);
                showToast(`Update sent to ${recipients} players`);
              }}
            >
              <Icon name="send" className="size-4" />
              Send to {recipients} players
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Goes to all 18 season players by email and text. Game-pass players for Game #204 are included.</p>
        <Field label="Message" htmlFor="team-update-msg">
          <TextArea id="team-update-msg" value={msg} onChange={(e) => setMsg(e.target.value)} />
        </Field>
      </Dialog>
      <Toast message={toast} />
    </>
  );
}
