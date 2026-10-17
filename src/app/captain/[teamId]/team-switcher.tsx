"use client";

import { useRouter } from "next/navigation";

/** Switch between the teams the user captains. */
export function TeamSwitcher({ teams, current }: { teams: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Switch team"
      value={current}
      onChange={(e) => router.push(`/captain/${e.target.value}`)}
      className="min-h-9 max-w-[38vw] truncate rounded-full border border-white/30 bg-white/10 px-3 text-[13.5px] font-bold text-white hover:bg-white/20 lg:max-w-[260px] [&>option]:text-fg"
    >
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
