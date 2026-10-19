import { Notice } from "@/components/ui/card";

const DONE: Record<string, string> = {
  "season-created": "created",
  "season-saved": "saved",
  "division-created": "created",
  "division-saved": "saved",
  "team-created": "created",
  "team-saved": "saved",
  "team-deleted": "deleted",
  "match-created": "created",
  "match-saved": "saved",
  "match-deleted": "deleted",
};

/** Success message after a save (from `?done=…&what=…`). */
export function DoneNotice({ done, what }: { done: string; what: string }) {
  const verb = DONE[done];
  if (!verb) return null;
  return (
    <Notice tone="ok" icon="check">
      <b>{what.slice(0, 80) || "Changes"}</b> {verb}.
    </Notice>
  );
}
