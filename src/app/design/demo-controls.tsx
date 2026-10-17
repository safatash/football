"use client";

import { useState } from "react";
import { ChoiceGroup, Segmented, Switch } from "@/components/ui/controls";
import { Field, TextInput } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper";

export function DemoControls() {
  const [cap, setCap] = useState(true);
  const [pos, setPos] = useState<"MID" | "FWD">("MID");
  const [teamTab, setTeamTab] = useState("ffx");
  return (
    <div className="grid gap-[18px] lg:grid-cols-2">
      <div className="flex flex-col gap-3.5">
        <Field label="Email" htmlFor="sg-email">
          <TextInput id="sg-email" defaultValue="maya.johnson@example.com" />
        </Field>
        <Field label="ZIP code" htmlFor="sg-zip" error="20878 is outside our usual area.">
          <TextInput id="sg-zip" defaultValue="20878" aria-invalid />
        </Field>
        <div className="flex items-center gap-3">
          <b className="flex-1 text-sm">Request captain access</b>
          <Switch checked={cap} onChange={setCap} label="Request captain access" />
        </div>
      </div>
      <div className="flex flex-col gap-3.5">
        <ChoiceGroup
          name="Position"
          value={pos}
          onChange={setPos}
          columns={2}
          options={[
            { value: "MID", label: "MID", sub: "Midfield" },
            { value: "FWD", label: "FWD", sub: "Forward" },
          ]}
        />
        <Segmented
          label="Team"
          active={teamTab}
          onChange={setTeamTab}
          items={[
            { key: "ffx", label: "Fairfax United · Captain" },
            { key: "bld", label: "Bloodline · Player" },
          ]}
        />
        <Stepper current={3} total={7} label="Contact" />
      </div>
    </div>
  );
}
