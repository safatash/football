"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/controls";
import { saveRefereeFees } from "@/lib/actions/referees";

type Row = { id: string; name: string; center: string; assistant: string; fourth: string };
const input = "h-[38px] w-24 min-w-24 rounded-[var(--radius-field)] border-[1.5px] border-line-strong bg-surface px-3 text-sm";

/** Default referee pay per role for each division. A match can override it per official. */
export function RefereeFees({ seasonId, divisions, readOnly }: { seasonId: string; divisions: Row[]; readOnly?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(divisions);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [toast, showToast] = useToast();
  const set = (id: string, k: "center" | "assistant" | "fourth", v: string) => setRows((list) => list.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const num = (v: string) => {
    const t = v.replace(/[$,\s]/g, "");
    return t === "" ? null : Number(t);
  };
  const save = () =>
    start(async () => {
      setError("");
      const res = await saveRefereeFees({ seasonId, divisions: rows.map((r) => ({ id: r.id, center: num(r.center), assistant: num(r.assistant), fourth: num(r.fourth) })) });
      if (!res.ok) return setError(res.error);
      showToast(res.message);
      router.refresh();
    });
  return (
    <Card as="section" className="flex flex-col gap-3">
      <h2 id="referee-fees" className="scroll-mt-24 text-[26px]">
        Referee fees
      </h2>
      <p className="text-[13.5px] text-muted">Default pay per match for each role. Leave blank for no default. Change a single match’s fee on its Officials card.</p>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[14px]">
          <thead className="text-left text-xs font-bold tracking-wide text-muted uppercase">
            <tr>
              <th className="py-2">Division</th>
              <th className="py-2">Center</th>
              <th className="py-2">Assistant (AR1/AR2)</th>
              <th className="py-2">4th official</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2 font-bold">{r.name}</td>
                {(["center", "assistant", "fourth"] as const).map((k) => (
                  <td key={k} className="py-2 pr-2">
                    <input aria-label={`${r.name} ${k} fee`} className={input} inputMode="decimal" value={r[k]} disabled={readOnly} onChange={(e) => set(r.id, k, e.target.value)} placeholder="$" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {readOnly ? null : (
        <div>
          <Button variant="primary" size="sm" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save referee fees"}
          </Button>
        </div>
      )}
      <Toast message={toast} />
    </Card>
  );
}
