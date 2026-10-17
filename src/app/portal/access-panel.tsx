import { Icon } from "@/components/ui/icon";
import { captainLine } from "./format";
import { RequestCaptainAccess } from "./portal-client";

/** What the viewer can do on this team. Captain actions only appear for captain memberships. */
export function AccessPanel({
  teamName,
  isCaptain,
  captainNames,
  requestPending,
}: {
  teamName: string;
  isCaptain: boolean;
  captainNames: string[];
  requestPending?: boolean;
}) {
  if (isCaptain) {
    return (
      <div className="flex flex-col gap-1.5 rounded-[var(--radius-field)] bg-lime/22 p-3.5">
        <div className="flex items-center gap-2">
          <Icon name="star" />
          <b>You captain {teamName}</b>
        </div>
        <p className="text-sm">You set the match roster, lineup and match reports for this team.</p>
      </div>
    );
  }
  const can = ["See the schedule, roster and standings", "Mark your availability and print the game roster"];
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-field)] bg-surface-2 p-3.5">
      <div className="flex items-center gap-2">
        <Icon name="user" />
        <b>{captainLine(captainNames, teamName)}</b>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {can.map((c) => (
          <li key={c} className="flex items-center gap-2">
            <Icon name="check" className="size-[15px] text-ok" />
            {c}
          </li>
        ))}
        <li className="flex items-center gap-2 text-muted">
          <Icon name="lock" className="size-[15px]" />
          Lineup and match roster are set by your captain
        </li>
      </ul>
      {requestPending ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-warn">
          <Icon name="wait" className="size-4" />
          Captain request · Pending review
        </span>
      ) : (
        <RequestCaptainAccess teamName={teamName} captainName={captainNames[0]} />
      )}
    </div>
  );
}
