"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput } from "@/components/ui/field";
import { setOfficials } from "@/lib/actions/admin";

const ROLES = ["Referee", "Assistant ref 1", "Assistant ref 2"];

export function OfficialsForm({ matchId, refs, referees, readOnly }: { matchId: string; refs: [string, string, string]; referees: string[]; readOnly?: boolean }) {
  const [crew, setCrew] = useState<string[]>([...refs]);
  const [dirty, setDirty] = useState(false);
  const [toast, showToast] = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      {ROLES.map((role, i) => (
        <Field key={role} label={role} htmlFor={`official-${i}`}>
          <SelectInput
            id={`official-${i}`}
            className="h-[42px]"
            value={crew[i]}
            disabled={readOnly}
            onChange={(e) => {
              const next = [...crew];
              next[i] = e.target.value;
              setCrew(next);
              setDirty(true);
            }}
          >
            <option value="">Unassigned</option>
            {referees.filter((r) => r === crew[i] || !crew.includes(r)).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </SelectInput>
        </Field>
      ))}
      {dirty && !readOnly ? (
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await setOfficials({ matchId, refs: crew });
              showToast(res.ok ? res.message : res.error);
              if (res.ok) {
                setDirty(false);
                router.refresh();
              }
            })
          }
        >
          Save officials
        </Button>
      ) : null}
      <Toast message={toast} />
    </div>
  );
}
