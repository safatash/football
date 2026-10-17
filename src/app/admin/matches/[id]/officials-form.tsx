"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput } from "@/components/ui/field";

const REFEREES = ["Daniel Kim", "Lucia Fernandes", "Omar Haddad", "Hugo Bell", "Sam Okoye", "Irene Park", "Tara Boone", "Paul Grant", "Ana Silva", "Luis Mejía"];
const ROLES = ["Referee", "Assistant ref 1", "Assistant ref 2"];

export function OfficialsForm({ refs, readOnly }: { refs: [string, string, string]; readOnly?: boolean }) {
  const [crew, setCrew] = useState<string[]>([...refs]);
  const [dirty, setDirty] = useState(false);
  const [toast, showToast] = useToast();
  const assigned = crew.filter(Boolean).length;

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
            {REFEREES.filter((r) => r === crew[i] || !crew.includes(r)).map((r) => (
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
          onClick={() => {
            setDirty(false);
            showToast(`Officials saved · ${assigned} of 3 assigned`);
          }}
        >
          Save officials
        </Button>
      ) : null}
      <Toast message={toast} />
    </div>
  );
}
