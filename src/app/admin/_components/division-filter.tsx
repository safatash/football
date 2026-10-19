"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * "All divisions" or one division, kept in the URL (`?division=wp`) so a filtered view can be
 * linked and survives a refresh. Other query params (season, search, status) are kept.
 */
export function DivisionFilter({ divisions, value, allLabel = "All divisions" }: { divisions: { code: string; name: string }[]; value: string; allLabel?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  function change(code: string) {
    const q = new URLSearchParams(params.toString());
    if (code) q.set("division", code);
    else q.delete("division");
    q.delete("done");
    q.delete("what");
    router.push(`${path}${q.size ? `?${q}` : ""}`, { scroll: false });
  }
  return (
    <label className="flex h-[38px] w-full items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-surface pr-2 pl-3.5 text-sm sm:w-auto">
      <span className="font-semibold whitespace-nowrap text-muted">Division</span>
      <select aria-label="Division" value={value} onChange={(e) => change(e.target.value)} className="h-full min-w-0 flex-1 cursor-pointer bg-transparent font-bold outline-none">
        <option value="">{allLabel}</option>
        {divisions.map((d) => (
          <option key={d.code} value={d.code}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}
