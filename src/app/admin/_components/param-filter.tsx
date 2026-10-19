"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A select that keeps its choice in the URL (`?division=wp`, `?payment=PAID`) so filtered views
 * can be linked and survive a refresh. Other query params (season, search, status) are kept.
 */
export function ParamFilter({ param, label, allLabel, options, value }: { param: string; label: string; allLabel: string; options: { value: string; label: string }[]; value: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  function change(next: string) {
    const q = new URLSearchParams(params.toString());
    if (next) q.set(param, next);
    else q.delete(param);
    q.delete("done");
    q.delete("what");
    router.push(`${path}${q.size ? `?${q}` : ""}`, { scroll: false });
  }
  return (
    <label className="flex h-[38px] w-full items-center gap-2 rounded-full border-[1.5px] border-line-strong bg-surface pr-2 pl-3.5 text-sm sm:w-auto">
      <span className="font-semibold whitespace-nowrap text-muted">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => change(e.target.value)} className="h-full min-w-0 flex-1 cursor-pointer bg-transparent font-bold outline-none">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
