import { ParamFilter } from "./param-filter";

/** "All divisions" or one division (`?division=wp`). Only codes and names reach the client. */
export function DivisionFilter({ divisions, value }: { divisions: { code: string; name: string }[]; value: string }) {
  return <ParamFilter param="division" label="Division" allLabel="All divisions" options={divisions.map((d) => ({ value: d.code, label: d.name }))} value={value} />;
}
