import { Badge, type Tone } from "@/components/ui/badge";
import type { PlacementLabel } from "@/lib/queries/placements";

const TONES: Record<PlacementLabel, Tone> = { New: "info", "Info requested": "warn", Waitlisted: "neutral", Assigned: "ok" };

export function PlacementBadge({ state }: { state: PlacementLabel }) {
  return <Badge tone={TONES[state]}>{state}</Badge>;
}
