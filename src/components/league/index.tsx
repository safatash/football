import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { addressLine, directionsUrl, type Place } from "@/lib/public";

export { Logo } from "@/components/brand";

export type CrestTeam = { name: string; color?: string | null; shortName?: string | null; logoUrl?: string | null };

/** Team crest: colored tile with the team's short code. Pass `team` or the parts. */
export function Crest({ team, name, color, ab, size = "md" }: { team?: CrestTeam; name?: string; color?: string | null; ab?: string | null; size?: "md" | "lg" }) {
  const bg = color ?? team?.color ?? "#0F3D2E";
  const code = (ab ?? team?.shortName ?? (name ?? team?.name ?? "").split(" ").map((w) => w[0]).join("")).slice(0, 3);
  if (team?.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- team logos are small static files
      <img
        src={team.logoUrl}
        alt=""
        aria-hidden
        className={`shrink-0 bg-surface object-contain ${size === "lg" ? "size-[52px] rounded-[14px]" : "size-9 rounded-[10px]"}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-display font-extrabold tracking-[0.02em] text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.35)] ${
        size === "lg" ? "size-[52px] rounded-[14px] text-[22px]" : "size-9 rounded-[10px] text-base"
      }`}
      style={{ background: bg }}
    >
      {code}
    </span>
  );
}

export function Avatar({ name, className = "" }: { name: string; className?: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return <span className={`grid size-[34px] shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-bold ${className}`}>{initials}</span>;
}

export function Jersey({ n, gamePass, small }: { n: number | string; gamePass?: boolean; small?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[9px] border bg-surface-2 font-display font-extrabold ${
        small ? "size-[30px] text-[15px]" : "size-9 text-lg"
      } ${gamePass ? "border-[1.5px] border-dashed border-pass text-pass" : "border-line"}`}
    >
      {n}
    </span>
  );
}

export function PosTag({ pos }: { pos: string }) {
  return <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-extrabold tracking-[0.06em] text-muted">{pos}</span>;
}

/** Home vs away row; score shows when present. */
export function VsRow({ home, away, score, onDark }: { home: CrestTeam; away: CrestTeam; score?: [number, number] | null; onDark?: boolean }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="flex min-w-0 items-center gap-2 font-bold">
        <Crest team={home} />
        <span className="truncate">{home.name}</span>
      </div>
      {score ? (
        <div className="font-display text-[28px] font-extrabold">
          {score[0]}–{score[1]}
        </div>
      ) : (
        <div className={`font-display text-[15px] font-extrabold ${onDark ? "text-white/70" : "text-muted"}`}>VS</div>
      )}
      <div className="flex min-w-0 items-center justify-end gap-2 text-right font-bold">
        <span className="truncate">{away.name}</span>
        <Crest team={away} />
      </div>
    </div>
  );
}

export function MatchMeta({ date, time, field, place, onDark, extra }: { date: string; time?: string; field?: string | null; place?: Place | null; onDark?: boolean; extra?: ReactNode }) {
  const map = place ? directionsUrl(place) : null;
  const address = place ? addressLine(place) : "";
  return (
    <div className={`flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] ${onDark ? "text-white/80" : "text-muted"}`}>
      <span className="inline-flex items-center gap-1.5">
        <Icon name="cal" className="size-[15px]" />
        {date}
      </span>
      {time ? (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="clock" className="size-[15px]" />
          {time}
        </span>
      ) : null}
      {field ? (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="pin" className="size-[15px]" />
          {field}
        </span>
      ) : null}
      {address || map ? (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          {address}
          {map ? (
            <a href={map} target="_blank" rel="noopener noreferrer" className={`font-bold underline underline-offset-4 ${onDark ? "text-lime" : "text-pitch-2 dark:text-lime"}`}>
              Directions
            </a>
          ) : null}
        </span>
      ) : null}
      {place?.notes ? <span className="basis-full">Parking: {place.notes}</span> : null}
      {extra}
    </div>
  );
}

export function PageHeading({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1 className="text-[34px] lg:text-[42px]">{title}</h1>
        {sub ? <p className="text-muted">{sub}</p> : null}
      </div>
      {actions ? <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
