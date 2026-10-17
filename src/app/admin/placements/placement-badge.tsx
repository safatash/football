import { Badge, type Tone } from "@/components/ui/badge";
import type { PlacementState } from "@/lib/league-data";

const TONES: Record<PlacementState, Tone> = { New: "info", "Info requested": "warn", Waitlisted: "neutral", Assigned: "ok" };

export function PlacementBadge({ state }: { state: PlacementState }) {
  return <Badge tone={TONES[state]}>{state}</Badge>;
}
