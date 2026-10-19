import type { Tone } from "@/components/ui/badge";

export const STATUS_TONE: Record<string, Tone> = { TRIAL: "info", ACTIVE: "ok", PAST_DUE: "warn", SUSPENDED: "bad", CANCELLED: "neutral" };
