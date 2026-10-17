"use client";

import { useState } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import type { TeamUpdateInfo } from "@/lib/queries/captain";

/** "Send a team update" button + dialog. Messages go to season players and this match's game-pass players. */
export function TeamUpdateButton({
  label = "Send a team update",
  variant = "ghost",
  size = "md",
  block,
  info,
  disabled,
}: {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  info: TeamUpdateInfo;
  disabled?: boolean;
}) {
  const { recipients } = info;
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState(info.message);
  const [toast, showToast] = useToast();
  return (
    <>
      <Button variant={variant} size={size} block={block} disabled={disabled} onClick={() => setOpen(true)}>
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
        <p className="text-sm text-muted">
          Goes to all {info.seasonPlayers} season players by email and text.
          {info.gameNumber && info.passPlayers ? ` Game-pass players for Game #${info.gameNumber} are included.` : ""}
        </p>
        <Field label="Message" htmlFor="team-update-msg">
          <TextArea id="team-update-msg" value={msg} onChange={(e) => setMsg(e.target.value)} />
        </Field>
      </Dialog>
      <Toast message={toast} />
    </>
  );
}
