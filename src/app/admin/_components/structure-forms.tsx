"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { CheckRow, ChoiceGroup, Dialog, Toast, useToast } from "@/components/ui/controls";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import {
  createDivision,
  createMatch,
  createSeason,
  copyDivisions,
  createTeam,
  deleteDivision,
  deleteMatch,
  deleteTeam,
  setJerseyNumber,
  updateDivision,
  updateMatch,
  updateSeason,
  updateTeam,
} from "@/lib/actions/admin-structure";
import { money } from "@/lib/format";
import { createField } from "@/lib/actions/fields";
import { addPlayerToTeam, removePlayerFromTeam, setCaptain } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/result";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k).replace(/[$,\s]/g, "");
  return v === "" ? null : Number(v);
};

/** Error notice with every message from the server. */
function Errors({ error, list }: { error: string; list?: string[] }) {
  if (!error) return null;
  return (
    <Notice tone="bad" title={error}>
      {list && list.length > 1 ? (
        <ul className="list-disc pl-5">
          {list.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </Notice>
  );
}

function FormActions({ pending, label, cancelHref, extra }: { pending: boolean; label: string; cancelHref: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      <ButtonLink href={cancelHref} variant="ghost">
        Cancel
      </ButtonLink>
      <span className="flex-1" />
      {extra}
    </div>
  );
}

/** Runs a save; on success returns to `doneHref` (with a done notice), else shows the errors. */
function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<string[] | undefined>();
  const run = <T,>(action: () => Promise<ActionResult<T>>, doneHref: (res: ActionResult<T> & { ok: true }) => string, onFail?: (res: ActionResult<T> & { ok: false }) => void) =>
    start(async () => {
      setError("");
      setErrors(undefined);
      const res = await action();
      if (!res.ok) {
        setError(res.error);
        setErrors(res.errors);
        onFail?.(res);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(doneHref(res));
      router.refresh();
    });
  return { pending, error, errors, run };
}

/** "Delete" with a confirmation dialog. Shows the server's reason when it refuses. */
export function DeleteButton({ label, title, body, action, doneHref }: { label: string; title: string; body: ReactNode; action: () => Promise<ActionResult>; doneHref: string }) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button variant="ghost" className="text-bad" onClick={() => (setProblem(""), setOpen(true))}>
        <Icon name="x" className="size-4" />
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
            {problem ? null : (
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await action();
                    if (!res.ok) return setProblem(res.error);
                    setOpen(false);
                    router.push(doneHref);
                    router.refresh();
                  })
                }
              >
                {pending ? "Deleting…" : "Delete"}
              </Button>
            )}
          </>
        }
      >
        {problem ? <Notice tone="warn">{problem}</Notice> : <div className="text-muted">{body}</div>}
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Season                                                              */
/* ------------------------------------------------------------------ */

export type SeasonFormValues = { id?: string; name: string; startDate: string; endDate: string; registrationOpensOn: string; registrationClosesOn: string; isActive: boolean };

export function SeasonForm({ season, activeName, templates }: { season?: SeasonFormValues; activeName: string; templates?: { key: "ADULT_REC" | "BLANK"; label: string; description: string }[] }) {
  const { pending, error, errors, run } = useSave();
  // A league's first season is active right away
  const [active, setActive] = useState(season?.isActive ?? !!templates);
  const [template, setTemplate] = useState<"ADULT_REC" | "BLANK">(templates?.[0]?.key ?? "BLANK");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      name: str(f, "name"),
      startDate: str(f, "startDate"),
      endDate: str(f, "endDate"),
      registrationOpensOn: str(f, "registrationOpensOn"),
      registrationClosesOn: str(f, "registrationClosesOn"),
      makeActive: active,
    };
    run(() => (season?.id ? updateSeason({ ...input, id: season.id }) : createSeason({ ...input, template })), () => `/admin/seasons?done=${season?.id ? "season-saved" : "season-created"}&what=${encodeURIComponent(input.name)}`);
  }
  return (
    <form onSubmit={submit} noValidate className="flex max-w-[640px] flex-col gap-4">
      <Errors error={error} list={errors} />
      <Card className="flex flex-col gap-4">
        <Field label="Season name" htmlFor="s-name" hint="e.g. Fall 2026">
          <TextInput id="s-name" name="name" defaultValue={season?.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opening day" htmlFor="s-start" hint="Age rules use this date">
            <TextInput id="s-start" name="startDate" type="date" defaultValue={season?.startDate} required />
          </Field>
          <Field label="Last day" htmlFor="s-end">
            <TextInput id="s-end" name="endDate" type="date" defaultValue={season?.endDate} required />
          </Field>
          <Field label="Registration opens" htmlFor="s-reg-open" hint="Optional. Leave empty to open as soon as the season is active">
            <TextInput id="s-reg-open" name="registrationOpensOn" type="date" defaultValue={season?.registrationOpensOn} />
          </Field>
          <Field label="Registration closes" htmlFor="s-reg-close" hint="Optional. Last day players can register">
            <TextInput id="s-reg-close" name="registrationClosesOn" type="date" defaultValue={season?.registrationClosesOn} />
          </Field>
        </div>
        <CheckRow
          checked={active}
          onChange={(v) => !season?.isActive && setActive(v)}
          title="Active season"
          sub={season?.isActive ? "This is the active season. Make another season active to change it." : `Registration, the portal and public pages switch to this season (now ${activeName}).`}
        />
      </Card>
      {templates ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-xl">Start from a template</h2>
          <div role="radiogroup" aria-label="Season template" className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={template === t.key}
                onClick={() => setTemplate(t.key)}
                className={`flex flex-col gap-1 rounded-xl border p-3.5 text-left ${template === t.key ? "border-pitch bg-pitch-tint" : "border-line hover:bg-surface-2"}`}
              >
                <b>{t.label}</b>
                <span className="text-[13px] text-muted">{t.description}</span>
              </button>
            ))}
          </div>
        </Card>
      ) : null}
      <FormActions pending={pending} label={season?.id ? "Save season" : "Create season"} cancelHref="/admin/seasons" />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Division                                                            */
/* ------------------------------------------------------------------ */

export type DivisionFormValues = {
  id?: string;
  code: string;
  name: string;
  level: string;
  description: string;
  fee: number;
  gamePassFee: number | null;
  status: "ACTIVE" | "INACTIVE";
  genderRule: "WOMEN" | "MEN" | "COED";
  minAge: number;
  maleCutoff: string;
  femaleCutoff: string;
  displayOrder: number;
  maxTeams: number | null;
  rosterMin: number | null;
  rosterMax: number | null;
};

export const DIVISION_LEVELS = ["Competitive", "Intermediate", "Recreational", "Social"];

export function DivisionForm({ seasonId, seasonQuery, division, leagueGamePassFee }: { seasonId: string; seasonQuery: string; division?: DivisionFormValues; leagueGamePassFee: number }) {
  const { pending, error, errors, run } = useSave();
  const [gender, setGender] = useState<DivisionFormValues["genderRule"]>(division?.genderRule ?? "COED");
  const [status, setStatus] = useState<DivisionFormValues["status"]>(division?.status ?? "ACTIVE");
  const back = `/admin/divisions${seasonQuery ? `?${seasonQuery}` : ""}`;
  // Keep a level from before the dropdown (e.g. "Social to intermediate") selectable
  const levels = division?.level && !DIVISION_LEVELS.includes(division.level) ? [...DIVISION_LEVELS, division.level] : DIVISION_LEVELS;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      seasonId,
      name: str(f, "name"),
      code: str(f, "code"),
      level: str(f, "level"),
      description: str(f, "description"),
      fee: num(f, "fee") ?? NaN, // required: an empty box is an error, not $0
      gamePassFee: num(f, "gamePassFee"),
      status,
      genderRule: gender,
      minAge: num(f, "minAge") ?? 18,
      maleCutoff: str(f, "maleCutoff") || null,
      femaleCutoff: str(f, "femaleCutoff") || null,
      displayOrder: num(f, "displayOrder") ?? 0,
      maxTeams: num(f, "maxTeams"),
      rosterMin: num(f, "rosterMin"),
      rosterMax: num(f, "rosterMax"),
    };
    run(
      () => (division?.id ? updateDivision({ ...input, id: division.id }) : createDivision(input)),
      () => `${back}${back.includes("?") ? "&" : "?"}done=${division?.id ? "division-saved" : "division-created"}&what=${encodeURIComponent(input.name)}`,
    );
  }
  const count = (v: number | null | undefined) => (v == null ? "" : String(v));
  return (
    <form onSubmit={submit} noValidate className="flex max-w-[720px] flex-col gap-4">
      <Errors error={error} list={errors} />
      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field label="Division name" htmlFor="d-name">
            <TextInput id="d-name" name="name" defaultValue={division?.name} required />
          </Field>
          <Field label="Code" htmlFor="d-code" hint="Used in links; optional">
            <TextInput id="d-code" name="code" defaultValue={division?.code} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Level" htmlFor="d-level">
            <SelectInput id="d-level" name="level" defaultValue={division?.level ?? ""}>
              <option value="">Not set</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Registration fee" htmlFor="d-fee" hint="Season fee, in dollars">
            <TextInput id="d-fee" name="fee" inputMode="decimal" defaultValue={division ? String(division.fee) : ""} required />
          </Field>
          <Field label="Display order" htmlFor="d-order">
            <TextInput id="d-order" name="displayOrder" inputMode="numeric" defaultValue={String(division?.displayOrder ?? 0)} />
          </Field>
        </div>
        <Field label="Game-pass fee" htmlFor="d-gp" hint={`Leave empty to use the league fee from Fees & eligibility (${money(leagueGamePassFee)})`}>
          <TextInput id="d-gp" name="gamePassFee" inputMode="decimal" className="sm:max-w-[200px]" defaultValue={division?.gamePassFee == null ? "" : String(division.gamePassFee)} />
        </Field>
        <Field label="Status">
          <ChoiceGroup<DivisionFormValues["status"]>
            name="Status"
            columns={2}
            value={status}
            onChange={setStatus}
            options={[
              { value: "ACTIVE", label: "Active", sub: "Open for registration and game passes" },
              { value: "INACTIVE", label: "Inactive", sub: "Hidden from players; admins still see it" },
            ]}
          />
        </Field>
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Who can play</h2>
        <ChoiceGroup<DivisionFormValues["genderRule"]>
          name="Who can play"
          columns={3}
          value={gender}
          onChange={setGender}
          options={[
            { value: "WOMEN", label: "Women" },
            { value: "MEN", label: "Men" },
            { value: "COED", label: "Coed" },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Minimum age" htmlFor="d-age" hint="On opening day">
            <TextInput id="d-age" name="minAge" inputMode="numeric" defaultValue={String(division?.minAge ?? 18)} />
          </Field>
          {gender !== "WOMEN" ? (
            <Field label={gender === "COED" ? "Men born on or before" : "Born on or before"} htmlFor="d-male" hint="Optional">
              <TextInput id="d-male" name="maleCutoff" type="date" defaultValue={division?.maleCutoff} />
            </Field>
          ) : null}
          {gender !== "MEN" ? (
            <Field label={gender === "COED" ? "Women born on or before" : "Born on or before"} htmlFor="d-female" hint="Optional">
              <TextInput id="d-female" name="femaleCutoff" type="date" defaultValue={division?.femaleCutoff} />
            </Field>
          ) : null}
        </div>
        <Field label="Rule text" htmlFor="d-desc" hint="Shown to players. Leave empty to build it from the rules above.">
          <TextInput id="d-desc" name="description" defaultValue={division?.description} />
        </Field>
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="text-xl">Teams and rosters</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Max teams" htmlFor="d-max" hint="Optional. New teams are refused past this.">
            <TextInput id="d-max" name="maxTeams" inputMode="numeric" defaultValue={count(division?.maxTeams)} />
          </Field>
          <Field label="Roster minimum" htmlFor="d-rmin" hint="Optional. Shown as a warning.">
            <TextInput id="d-rmin" name="rosterMin" inputMode="numeric" defaultValue={count(division?.rosterMin)} />
          </Field>
          <Field label="Roster maximum" htmlFor="d-rmax" hint="Optional. Shown as a warning.">
            <TextInput id="d-rmax" name="rosterMax" inputMode="numeric" defaultValue={count(division?.rosterMax)} />
          </Field>
        </div>
      </Card>
      <FormActions
        pending={pending}
        label={division?.id ? "Save division" : "Create division"}
        cancelHref={back}
        extra={
          division?.id ? (
            <DeleteButton
              label="Delete division"
              title={`Delete ${division.name}?`}
              body="This removes the division. It can’t be undone. Divisions with teams or registrations can’t be deleted; set them to inactive instead."
              action={() => deleteDivision({ id: division.id! })}
              doneHref={`${back}${back.includes("?") ? "&" : "?"}done=division-deleted&what=${encodeURIComponent(division.name)}`}
            />
          ) : null
        }
      />
    </form>
  );
}

/** "Copy from another season" for the divisions list and its empty state. */
export function CopyDivisionsButton({
  toSeasonId,
  toSeasonName,
  sources,
  seasonQuery,
  primary,
}: {
  toSeasonId: string;
  toSeasonName: string;
  sources: { id: string; name: string; divisions: string[] }[];
  seasonQuery: string;
  primary?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(sources[0]?.id ?? "");
  const [problem, setProblem] = useState("");
  const [pending, start] = useTransition();
  const source = sources.find((x) => x.id === from);
  if (!sources.length) return null;
  return (
    <>
      <Button variant={primary ? "primary" : "ghost"} size="sm" onClick={() => (setProblem(""), setOpen(true))}>
        <Icon name="list" className="size-4" />
        Copy from another season
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Copy divisions into ${toSeasonName}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={pending || !source}
              onClick={() =>
                start(async () => {
                  setProblem("");
                  const res = await copyDivisions({ fromSeasonId: from, toSeasonId });
                  if (!res.ok) return setProblem(res.error);
                  setOpen(false);
                  router.push(`/admin/divisions?done=divisions-copied&what=${encodeURIComponent(res.message)}${seasonQuery ? `&${seasonQuery}` : ""}`);
                  router.refresh();
                })
              }
            >
              {pending ? "Copying…" : `Copy ${source?.divisions.length ?? 0} divisions`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {problem ? <Notice tone="warn">{problem}</Notice> : null}
          <Field label="Copy from" htmlFor="copy-from">
            <SelectInput id="copy-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              {sources.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.divisions.length})
                </option>
              ))}
            </SelectInput>
          </Field>
          {source ? <p className="text-[13.5px] text-muted">{source.divisions.join(", ")}</p> : null}
          <p className="text-[13.5px] text-muted">
            Copies name, level, fees, age rules, who can play and limits. “18 on opening day” rules follow {toSeasonName}’s opening day, and fixed birth dates move by the years between the
            seasons. Any division {toSeasonName} already has is skipped. Teams aren’t copied.
          </p>
        </div>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Players picker                                                      */
/* ------------------------------------------------------------------ */

export type PickablePlayer = { id: string; name: string; detail: string };

/** Search existing players and pick one or more. */
export function PlayerPicker({ players, selected, onChange, max = 4, label, exclude = [] }: { players: PickablePlayer[]; selected: string[]; onChange: (ids: string[]) => void; max?: number; label: string; exclude?: string[] }) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const needle = q.trim().toLowerCase();
  const matches = needle.length < 2 ? [] : players.filter((p) => !selected.includes(p.id) && !exclude.includes(p.id) && p.name.toLowerCase().includes(needle)).slice(0, 8);
  return (
    <div className="flex flex-col gap-2">
      {selected.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label}: selected`}>
          {selected.map((id) => (
            <li key={id} className="inline-flex h-8 items-center gap-1 rounded-full bg-lime/30 pr-1 pl-3 text-[13px] font-bold">
              {byId.get(id)?.name ?? "Player"}
              <button type="button" aria-label={`Remove ${byId.get(id)?.name ?? "player"}`} className="grid size-6 place-items-center rounded-full hover:bg-surface-3" onClick={() => onChange(selected.filter((x) => x !== id))}>
                <Icon name="x" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected.length < max ? (
        <>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players by name" aria-label={label} />
          {matches.length ? (
            <ul className="flex flex-col overflow-hidden rounded-[var(--radius-field)] border border-line">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-3 border-b border-line px-3.5 text-left last:border-b-0 hover:bg-surface-2"
                    onClick={() => {
                      onChange([...selected, p.id]);
                      setQ("");
                    }}
                  >
                    <b className="text-sm">{p.name}</b>
                    <span className="truncate text-xs text-muted">{p.detail}</span>
                    <Icon name="plus" className="ml-auto size-4 text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          ) : needle.length >= 2 ? (
            <span className="text-[13px] text-muted">No players match “{q}”. Add them under Players first.</span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Team                                                                */
/* ------------------------------------------------------------------ */

type DivisionOption = { id: string; name: string; seasonId: string; status?: "ACTIVE" | "INACTIVE" };
type SeasonOption = { id: string; name: string };

export type TeamFormValues = { id: string; seasonId: string; divisionId: string; name: string; status: "ACTIVE" | "INACTIVE"; shortName: string; color: string; homeField: string };

export function TeamForm({
  seasons,
  divisions,
  players,
  team,
  seasonId: initialSeason,
  seasonQuery,
  divisionId: initialDivision,
  backHref,
}: {
  seasons: SeasonOption[];
  divisions: DivisionOption[];
  players: PickablePlayer[];
  team?: TeamFormValues;
  seasonId: string;
  seasonQuery: string;
  /** Pre-selected division (e.g. "Add team" on a division page). */
  divisionId?: string;
  /** Where Cancel and a successful save go; defaults to the teams list. */
  backHref?: string;
}) {
  const { pending, error, errors, run } = useSave();
  const [seasonId, setSeasonId] = useState(team?.seasonId ?? initialSeason);
  const options = divisions.filter((d) => d.seasonId === seasonId);
  const [divisionId, setDivisionId] = useState(team?.divisionId ?? (options.some((d) => d.id === initialDivision) ? initialDivision! : (options[0]?.id ?? "")));
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(team?.status ?? "ACTIVE");
  const [captains, setCaptains] = useState<string[]>([]);
  const back = backHref ?? `/admin/teams${seasonQuery ? `?${seasonQuery}` : ""}`;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = str(f, "name");
    if (team) {
      run(
        () => updateTeam({ id: team.id, divisionId, name, status, shortName: str(f, "shortName"), color: str(f, "color"), homeField: str(f, "homeField") }),
        () => `${back}${back.includes("?") ? "&" : "?"}done=team-saved&what=${encodeURIComponent(name)}`,
      );
    } else {
      run(
        () => createTeam({ seasonId, divisionId, name, status, captainPlayerIds: captains }),
        () => `${back}${back.includes("?") ? "&" : "?"}done=team-created&what=${encodeURIComponent(name)}`,
      );
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[720px] flex-col gap-4">
      <Errors error={error} list={errors} />
      <Card className="flex flex-col gap-4">
        <Field label="Team name" htmlFor="t-name" hint="Must be unique this season">
          <TextInput id="t-name" name="name" defaultValue={team?.name} required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Season" htmlFor="t-season">
            <SelectInput
              id="t-season"
              value={seasonId}
              disabled={!!team}
              onChange={(e) => {
                setSeasonId(e.target.value);
                setDivisionId(divisions.find((d) => d.seasonId === e.target.value)?.id ?? "");
              }}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Division" htmlFor="t-division" hint={options.length ? undefined : "This season has no divisions yet. Add one under Divisions."}>
            <SelectInput id="t-division" value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
              {options.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.status === "INACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label="Status">
          <ChoiceGroup<"ACTIVE" | "INACTIVE">
            name="Status"
            columns={2}
            value={status}
            onChange={setStatus}
            options={[
              { value: "ACTIVE", label: "Active", sub: "Plays this season" },
              { value: "INACTIVE", label: "Inactive", sub: "Kept for history" },
            ]}
          />
        </Field>
        {team ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Crest letters" htmlFor="t-short" hint="Up to 4">
              <TextInput id="t-short" name="shortName" maxLength={4} defaultValue={team.shortName} />
            </Field>
            <Field label="Crest color" htmlFor="t-color">
              <TextInput id="t-color" name="color" type="color" className="!p-1.5" defaultValue={team.color || "#0F3D2E"} />
            </Field>
            <Field label="Home field" htmlFor="t-home" hint="Optional">
              <TextInput id="t-home" name="homeField" defaultValue={team.homeField} />
            </Field>
          </div>
        ) : (
          <Field label="Captains" hint="Optional. They’re added to the roster as captains.">
            <PlayerPicker players={players} selected={captains} onChange={setCaptains} label="Add a captain" />
          </Field>
        )}
      </Card>
      <FormActions pending={pending} label={team ? "Save team" : "Create team"} cancelHref={back} />
    </form>
  );
}

export type RosterEntry = { playerId: string; name: string; jersey: number | null; captain: boolean; position: string };

/** Roster tools on the team edit page: add/remove players, jersey numbers, captains. */
export function RosterManager({ teamId, roster, players, readOnly }: { teamId: string; roster: RosterEntry[]; players: PickablePlayer[]; readOnly?: boolean }) {
  const [toast, showToast] = useToast();
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<string[]>([]);
  const [removing, setRemoving] = useState<RosterEntry | null>(null);
  const [jerseys, setJerseys] = useState<Record<string, string>>(() => Object.fromEntries(roster.map((r) => [r.playerId, r.jersey == null ? "" : String(r.jersey)])));
  const router = useRouter();
  const act = (action: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const res = await action();
      showToast(res.ok ? res.message : res.error);
      if (res.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[19px] font-bold">Roster</h3>
        <span className="text-sm text-muted">{roster.length} players</span>
      </div>
      {roster.length ? (
        <ul className="flex flex-col overflow-hidden rounded-[var(--radius-field)] border border-line">
          {roster.map((r) => (
            <li key={r.playerId} className="flex flex-wrap items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-b-0">
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (jerseys[r.playerId] ?? "").trim();
                  if (v && !/^\d{1,2}$/.test(v)) return showToast("Jersey numbers are 0–99.");
                  act(() => setJerseyNumber({ playerId: r.playerId, teamId, jerseyNumber: v ? Number(v) : null }));
                }}
              >
                <label className="sr-only" htmlFor={`j-${r.playerId}`}>{`${r.name} jersey number`}</label>
                <TextInput
                  id={`j-${r.playerId}`}
                  className="!h-10 w-16 text-center"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="#"
                  disabled={readOnly}
                  value={jerseys[r.playerId] ?? ""}
                  onChange={(e) => setJerseys((j) => ({ ...j, [r.playerId]: e.target.value }))}
                />
                {(jerseys[r.playerId] ?? "") !== (r.jersey == null ? "" : String(r.jersey)) ? (
                  <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                    Save #
                  </Button>
                ) : null}
              </form>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm">{r.name}</b>
                <span className="text-xs text-muted">{r.position || "No position"}</span>
              </span>
              <Button
                variant={r.captain ? "primary" : "ghost"}
                size="sm"
                disabled={readOnly || pending}
                aria-pressed={r.captain}
                onClick={() => act(() => setCaptain({ playerId: r.playerId, teamId, isCaptain: !r.captain }))}
              >
                <Icon name="star" className="size-3.5" />
                {r.captain ? "Captain" : "Make captain"}
              </Button>
              <Button variant="ghost" size="sm" className="text-bad" disabled={readOnly || pending} onClick={() => setRemoving(r)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No players yet.</p>
      )}
      {readOnly ? null : (
        <Field label="Add players" hint="They must fit the division’s age and gender rules.">
          <PlayerPicker players={players} selected={adding} onChange={setAdding} max={10} label="Add a player" exclude={roster.map((r) => r.playerId)} />
          {adding.length ? (
            <Button
              variant="primary"
              size="sm"
              className="self-start"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const failed: string[] = [];
                  for (const id of adding) {
                    const res = await addPlayerToTeam({ playerId: id, teamId });
                    if (!res.ok) failed.push(res.error);
                  }
                  setAdding([]);
                  showToast(failed.length ? failed[0] : `Added ${adding.length} player${adding.length === 1 ? "" : "s"}`);
                  router.refresh();
                })
              }
            >
              Add {adding.length} to roster
            </Button>
          ) : null}
        </Field>
      )}
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.name}?` : ""}
        actions={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => removing && act(() => removePlayerFromTeam({ playerId: removing.playerId, teamId }), () => setRemoving(null))}>
              Remove from team
            </Button>
          </>
        }
      >
        <p className="text-muted">They come off the roster and any draft match roster for upcoming games, and lose captain access here. Past games stay as they are.</p>
      </Dialog>
      <Toast message={toast} />
    </Card>
  );
}

export function DeleteTeamButton({ id, name, back }: { id: string; name: string; back: string }) {
  return (
    <DeleteButton
      label="Delete team"
      title={`Delete ${name}?`}
      body="This removes the team and its roster. It can’t be undone. Teams that have matches can’t be deleted; set them to inactive instead."
      action={() => deleteTeam({ id })}
      doneHref={`${back}${back.includes("?") ? "&" : "?"}done=team-deleted&what=${encodeURIComponent(name)}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Quick add field (from the match form)                               */
/* ------------------------------------------------------------------ */

/** Adds a field without leaving the match being entered. Plain inputs: it sits inside the match form. */
function QuickAddField({ open, parks: initialParks, onClose, onAdded }: { open: boolean; parks: ParkOption[]; onClose: () => void; onAdded: (f: FieldOption) => void }) {
  const [parks, setParks] = useState(initialParks);
  const [parkId, setParkId] = useState(initialParks[0]?.id ?? "__new");
  const [parkName, setParkName] = useState("");
  const [city, setCity] = useState("");
  const [name, setName] = useState("");
  const [surface, setSurface] = useState<"GRASS" | "TURF">("GRASS");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setError("");
      const res = await createField({ name, surface, parkId: parkId === "__new" ? null : parkId, newPark: parkId === "__new" ? { name: parkName, city } : null });
      if (!res.ok || !res.data) return setError(res.ok ? "Something went wrong." : res.error);
      // A park created here becomes the park for the next quick add
      if (parkId === "__new") setParks((list) => [...list, { id: res.data!.parkId, name: parkName.trim(), city: city.trim() || null }].sort((a, b) => a.name.localeCompare(b.name)));
      setParkId(res.data.parkId);
      setName("");
      setParkName("");
      setCity("");
      onAdded(res.data);
    });
  const noEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a field"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={pending} onClick={save}>
            {pending ? "Adding…" : "Add field"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" onKeyDown={noEnter}>
        {error ? <Notice tone="bad">{error}</Notice> : null}
        <Field label="Park" htmlFor="qa-park">
          <SelectInput id="qa-park" value={parkId} onChange={(e) => setParkId(e.target.value)}>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.name, p.city].filter(Boolean).join(" · ")}
              </option>
            ))}
            <option value="__new">New park…</option>
          </SelectInput>
        </Field>
        {parkId === "__new" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Park name" htmlFor="qa-pname">
              <TextInput id="qa-pname" value={parkName} onChange={(e) => setParkName(e.target.value)} />
            </Field>
            <Field label="City" htmlFor="qa-city" hint="Address can be added later">
              <TextInput id="qa-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Field name or number" htmlFor="qa-name">
            <TextInput id="qa-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Surface" htmlFor="qa-surface">
            <SelectInput id="qa-surface" value={surface} onChange={(e) => setSurface(e.target.value as "GRASS" | "TURF")}>
              <option value="GRASS">Grass</option>
              <option value="TURF">Turf</option>
            </SelectInput>
          </Field>
        </div>
        <p className="text-[13px] text-muted">Your match details stay as they are.</p>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Match                                                               */
/* ------------------------------------------------------------------ */

type TeamOption = { id: string; name: string; divisionId: string };
type FieldOption = { id: string; label: string; parkId: string; park: string };
type ParkOption = { id: string; name: string; city: string | null };
type Status = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "POSTPONED";

export type MatchFormValues = {
  id: string;
  seasonId: string;
  divisionId: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  fieldId: string;
  status: Status;
  gameNumber: number;
  homeScore: number | null;
  awayScore: number | null;
  passes: number;
};

export function MatchForm({
  seasons,
  divisions,
  teams,
  fields: initialFields,
  parks: initialParks,
  match,
  seasonId: initialSeason,
  seasonQuery,
  divisionId: initialDivision,
  backHref,
}: {
  seasons: SeasonOption[];
  divisions: DivisionOption[];
  teams: (TeamOption & { seasonId: string })[];
  fields: FieldOption[];
  parks: ParkOption[];
  match?: MatchFormValues;
  seasonId: string;
  seasonQuery: string;
  /** Pre-selected division (e.g. "Add match" on a division page). */
  divisionId?: string;
  /** Where Cancel and a successful save go; defaults to the matches list. */
  backHref?: string;
}) {
  const { pending, error, errors, run } = useSave();
  const [seasonId, setSeasonId] = useState(match?.seasonId ?? initialSeason);
  const divs = divisions.filter((d) => d.seasonId === seasonId);
  const [divisionId, setDivisionId] = useState(match?.divisionId ?? (divs.some((d) => d.id === initialDivision) ? initialDivision! : (divs[0]?.id ?? "")));
  const inDiv = teams.filter((t) => t.seasonId === seasonId && t.divisionId === divisionId);
  const [home, setHome] = useState(match?.homeTeamId ?? "");
  const [away, setAway] = useState(match?.awayTeamId ?? "");
  const [status, setStatus] = useState<Status>(match?.status ?? "SCHEDULED");
  const [fieldId, setFieldId] = useState(match?.fieldId ?? "");
  const [fields, setFields] = useState(initialFields);
  const [quickAdd, setQuickAdd] = useState(false);
  // Field dropdown grouped by park, in the order the server sent them
  const fieldGroups = [...new Map(fields.map((f) => [f.parkId, f.park])).entries()].map(([parkId, park]) => ({ park, options: fields.filter((f) => f.parkId === parkId) }));
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [pendingInput, setPendingInput] = useState<Parameters<typeof createMatch>[0] | null>(null);
  const back = backHref ?? `/admin/matches${seasonQuery ? `?${seasonQuery}` : ""}`;

  const save = (input: Parameters<typeof createMatch>[0]) =>
    run(
      () => (match ? updateMatch({ ...input, id: match.id }) : createMatch(input)),
      (res) => `${back}${back.includes("?") ? "&" : "?"}done=${match ? "match-saved" : "match-created"}&what=${encodeURIComponent(`Game #${res.data?.gameNumber ?? ""}`)}`,
      (res) => {
        // Schedule clashes: show them and offer "Save anyway"
        if (res.status === 409 && res.errors?.length && res.error.startsWith("Check the schedule")) {
          setWarnings(res.errors);
          setPendingInput(input);
        }
      },
    );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setWarnings(null);
    const f = new FormData(e.currentTarget);
    save({
      seasonId,
      divisionId,
      homeTeamId: home,
      awayTeamId: away,
      date: str(f, "date"),
      time: str(f, "time"),
      fieldId: fieldId || null,
      status,
      gameNumber: num(f, "gameNumber"),
      homeScore: status === "COMPLETED" ? num(f, "homeScore") : null,
      awayScore: status === "COMPLETED" ? num(f, "awayScore") : null,
      force: false,
    });
  }

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? (id === home ? "Home" : "Away");

  return (
    <form onSubmit={submit} noValidate className="flex max-w-[760px] flex-col gap-4">
      {warnings ? (
        <Notice tone="warn" title="Schedule clash">
          <ul className="list-disc pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <span className="mt-2 flex gap-2">
            <Button type="button" variant="primary" size="sm" disabled={pending} onClick={() => pendingInput && save({ ...pendingInput, force: true })}>
              Save anyway
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setWarnings(null)}>
              Change it
            </Button>
          </span>
        </Notice>
      ) : (
        <Errors error={error} list={errors} />
      )}
      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Season" htmlFor="m-season">
            <SelectInput
              id="m-season"
              value={seasonId}
              disabled={!!match}
              onChange={(e) => {
                setSeasonId(e.target.value);
                setDivisionId(divisions.find((d) => d.seasonId === e.target.value)?.id ?? "");
                setHome("");
                setAway("");
              }}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Division" htmlFor="m-division">
            <SelectInput
              id="m-division"
              value={divisionId}
              onChange={(e) => {
                setDivisionId(e.target.value);
                setHome("");
                setAway("");
              }}
            >
              {divs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.status === "INACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home team" htmlFor="m-home">
            <SelectInput id="m-home" value={home} onChange={(e) => setHome(e.target.value)}>
              <option value="">Choose…</option>
              {inDiv.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === away}>
                  {t.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Away team" htmlFor="m-away">
            <SelectInput id="m-away" value={away} onChange={(e) => setAway(e.target.value)}>
              <option value="">Choose…</option>
              {inDiv.map((t) => (
                <option key={t.id} value={t.id} disabled={t.id === home}>
                  {t.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" htmlFor="m-date">
            <TextInput id="m-date" name="date" type="date" defaultValue={match?.date} required />
          </Field>
          <Field label="Start time" htmlFor="m-time" hint="Eastern time">
            <TextInput id="m-time" name="time" type="time" step={300} defaultValue={match?.time ?? "09:00"} required />
          </Field>
          <Field label="Game #" htmlFor="m-no" hint={match ? undefined : "Blank = next number"}>
            <TextInput id="m-no" name="gameNumber" inputMode="numeric" defaultValue={match ? String(match.gameNumber) : ""} />
          </Field>
        </div>
        <Field label="Field" htmlFor="m-field">
          <SelectInput id="m-field" value={fieldId} onChange={(e) => (e.target.value === "__new" ? setQuickAdd(true) : setFieldId(e.target.value))}>
            <option value="">To be announced</option>
            {fieldGroups.map((g) => (
              <optgroup key={g.park} label={g.park}>
                {g.options.map((f) => (
                  <option key={f.id} value={f.id}>
                    {g.park.split(" · ")[0]} · {f.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="__new">+ Add new field…</option>
          </SelectInput>
        </Field>
        <QuickAddField
          open={quickAdd}
          parks={initialParks}
          onClose={() => setQuickAdd(false)}
          onAdded={(f) => {
            setFields((list) => [...list, f]);
            setFieldId(f.id);
            setQuickAdd(false);
          }}
        />
        <Field label="Status">
          <ChoiceGroup<Status>
            name="Status"
            columns={4}
            value={status}
            onChange={setStatus}
            options={[
              { value: "SCHEDULED", label: "Scheduled" },
              { value: "COMPLETED", label: "Completed" },
              { value: "POSTPONED", label: "Postponed" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />
        </Field>
        {status === "COMPLETED" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`${teamName(home)} score`} htmlFor="m-hs" hint="Counts in the standings">
              <TextInput id="m-hs" name="homeScore" inputMode="numeric" defaultValue={match?.homeScore != null ? String(match.homeScore) : ""} />
            </Field>
            <Field label={`${teamName(away)} score`} htmlFor="m-as">
              <TextInput id="m-as" name="awayScore" inputMode="numeric" defaultValue={match?.awayScore != null ? String(match.awayScore) : ""} />
            </Field>
          </div>
        ) : null}
      </Card>
      <FormActions
        pending={pending}
        label={match ? "Save match" : "Create match"}
        cancelHref={back}
        extra={
          match ? (
            <DeleteButton
              label="Delete match"
              title={`Delete Game #${match.gameNumber}?`}
              body={
                match.passes
                  ? `${match.passes} player${match.passes === 1 ? " has" : "s have"} a game pass for this match, so it can’t be deleted. Set it to cancelled instead.`
                  : "This removes the match with its rosters and reports. It can’t be undone. If it just isn’t happening, set it to cancelled instead."
              }
              action={() => deleteMatch({ id: match.id })}
              doneHref={`${back}${back.includes("?") ? "&" : "?"}done=match-deleted&what=${encodeURIComponent(`Game #${match.gameNumber}`)}`}
            />
          ) : null
        }
      />
    </form>
  );
}
