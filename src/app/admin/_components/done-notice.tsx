import { Notice } from "@/components/ui/card";

const DONE: Record<string, string> = {
  "season-created": "created",
  "season-saved": "saved",
  "division-created": "created",
  "division-saved": "saved",
  "division-deleted": "deleted",
  "team-created": "created",
  "team-saved": "saved",
  "team-deleted": "deleted",
  "match-created": "created",
  "match-saved": "saved",
  "match-deleted": "deleted",
};

/** Success message after a save (from `?done=…&what=…`). */
export function DoneNotice({ done, what }: { done: string; what: string }) {
  // Copying reports a whole sentence ("Copied 5 divisions from Fall 2025")
  if (done === "divisions-copied")
    return (
      <Notice tone="ok" icon="check">
        {what.slice(0, 240)}.
      </Notice>
    );
  const verb = DONE[done];
  if (!verb) return null;
  return (
    <Notice tone="ok" icon="check">
      <b>{what.slice(0, 80) || "Changes"}</b> {verb}.
    </Notice>
  );
}
