import { DEFAULT_LINEUP, type RosterPlayer } from "@/lib/league-data";

export type RosterStatus = "Starter" | "Bench" | "Unavailable" | "Suspended";

const starters = new Set(Object.values(DEFAULT_LINEUP));

/** Season-roster status for the next match, derived from the saved lineup and availability. */
export function rosterStatus(p: RosterPlayer, override?: RosterStatus): RosterStatus {
  if (p.suspended) return "Suspended";
  if (override) return override;
  if (p.avail === "no") return "Unavailable";
  return starters.has(p.jersey) ? "Starter" : "Bench";
}

export const statusTone: Record<RosterStatus, "ok" | "neutral" | "warn" | "bad"> = {
  Starter: "ok",
  Bench: "neutral",
  Unavailable: "warn",
  Suspended: "bad",
};

/** Small colored availability line: Available / Unavailable · note / Maybe / Suspended */
export function AvailText({ p }: { p: RosterPlayer }) {
  const [label, cls] = p.suspended
    ? ["Suspended", "text-bad"]
    : p.avail === "yes"
      ? ["Available", "text-ok"]
      : p.avail === "no"
        ? [`Unavailable${p.note ? ` · ${p.note}` : ""}`, "text-bad"]
        : [p.note || "Maybe", "text-warn"];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${cls}`}>
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

export const firstLast = (name: string) => {
  const [first, last = ""] = name.split(" ");
  return `${first} ${last[0] ?? ""}.`;
};
