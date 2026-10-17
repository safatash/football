"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckRow, Toast, useToast } from "@/components/ui/controls";
import { inputClass } from "@/components/ui/field";
import {
  addAllowedZip,
  addBlock,
  createDiscountCode,
  deleteDiscountCode,
  removeAllowedZip,
  removeBlock,
  saveSettings,
  setDiscountCodeActive,
} from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/actions/result";
import { Icon } from "@/components/ui/icon";
import { BodyCell, BodyRow, DataTable, HeadCell, TableBody, TableHead, TableWrap } from "@/components/ui/table";
import { money } from "@/lib/format";
import type { DiscountCodeView } from "@/lib/queries/admin-league";

const small = `${inputClass} !h-10 text-[15px]`;

/** A division's fee and eligibility, as dates (YYYY-MM-DD) for the date inputs. */
export type DivisionSetting = {
  id: string;
  code: string;
  name: string;
  fee: number;
  /** Born-on-or-before cutoff when it's the same for everyone in the division. */
  cutoff: string | null;
  /** Separate cutoffs for a coed division. */
  menCutoff: string | null;
  womenCutoff: string | null;
  gender: string;
};

export function SettingsForm({
  seasonId,
  teams,
  divisions,
  gamePassFee,
  discountCodes,
  fairfaxCountyAllowed,
  zips: initialZips,
  blocklist: initialBlock,
  readOnly,
  notice,
}: {
  seasonId: string;
  teams: { id: string; name: string }[];
  divisions: DivisionSetting[];
  gamePassFee: number;
  discountCodes: DiscountCodeView[];
  fairfaxCountyAllowed: boolean;
  zips: string[];
  blocklist: string[];
  readOnly?: boolean;
  notice: ReactNode;
}) {
  const [toast, showToast] = useToast();
  const [fairfax, setFairfax] = useState(fairfaxCountyAllowed);
  const [zips, setZips] = useState(initialZips);
  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState("");
  const [block, setBlock] = useState(initialBlock);
  const [entry, setEntry] = useState("");
  const [blockError, setBlockError] = useState("");
  const [code, setCode] = useState({ code: "", kind: "PROMO", type: "AMOUNT", value: "", maxUses: "", teamId: "" });
  const [codeError, setCodeError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  /** Runs an action, toasts the result and refreshes the page data. */
  const run = (action: () => Promise<ActionResult<unknown>>, onOk?: () => void, onError?: (msg: string) => void) =>
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        if (onError) onError(res.error);
        else showToast(res.error);
        return;
      }
      onOk?.();
      showToast(res.message);
      router.refresh();
    });

  const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[$,\s]/g, ""));

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fees = divisions.map((d) => num(f.get(`fee-${d.id}`)));
    if ([...fees, num(f.get("gamePassFee"))].some((n) => !Number.isFinite(n) || n < 0)) return showToast("Fees must be dollar amounts.");
    const date = (k: string) => (f.get(k) ? String(f.get(k)) : null);
    run(() =>
      saveSettings({
        seasonId,
        gamePassFee: num(f.get("gamePassFee")),
        fairfaxCountyAllowed: fairfax,
        divisions: divisions.map((d, i) =>
          d.menCutoff || d.womenCutoff
            ? { id: d.id, fee: fees[i], menCutoff: date(`men-${d.id}`), womenCutoff: date(`women-${d.id}`) }
            : { id: d.id, fee: fees[i], cutoff: date(`cutoff-${d.id}`) },
        ),
      }),
    );
  }

  function addZip(e: FormEvent) {
    e.preventDefault();
    const z = zip.trim();
    if (!/^\d{5}$/.test(z)) return setZipError("Enter a 5-digit ZIP code.");
    if (zips.includes(z)) return setZipError(`${z} is already allowed.`);
    run(
      () => addAllowedZip({ zip: z }),
      () => {
        setZips([...zips, z].sort());
        setZip("");
        setZipError("");
      },
      setZipError,
    );
  }

  function addBlockEntry(e: FormEvent) {
    e.preventDefault();
    const v = entry.trim().toLowerCase();
    if (!/^(\*@)?[^\s@]+(@[^\s@]+)?\.[^\s@]+$/.test(v)) return setBlockError("Enter an email address or a domain.");
    if (block.includes(v)) return setBlockError(`${v} is already blocked.`);
    run(
      () => addBlock({ entry: v }),
      () => {
        setBlock([v, ...block]);
        setEntry("");
        setBlockError("");
      },
      setBlockError,
    );
  }

  function addCode(e: FormEvent) {
    e.preventDefault();
    const value = num(code.value);
    const maxUses = code.maxUses.trim() ? Number(code.maxUses) : null;
    if (!code.code.trim()) return setCodeError("Enter a code.");
    if (!(value > 0)) return setCodeError("Enter a value above 0.");
    if (maxUses != null && !(Number.isInteger(maxUses) && maxUses > 0)) return setCodeError("Max uses must be a whole number.");
    run(
      () =>
        createDiscountCode({
          seasonId,
          code: code.code,
          kind: code.kind as "BOARD" | "PROMO" | "TEAM_PAID",
          type: code.type as "PERCENT" | "AMOUNT",
          value,
          maxUses,
          teamId: code.kind === "TEAM_PAID" ? code.teamId || null : null,
        }),
      () => {
        setCode({ code: "", kind: "PROMO", type: "AMOUNT", value: "", maxUses: "", teamId: "" });
        setCodeError("");
      },
      setCodeError,
    );
  }

  return (
    <>
      <PageHeading
        title="Fees & eligibility"
        sub="Season pricing, discount codes and who can register"
        actions={
          <Button type="submit" form="settings-save" variant="primary" size="sm" disabled={readOnly || pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        }
      />
      {notice}
      <form id="settings-save" onSubmit={save} className="hidden" />

      <fieldset disabled={readOnly} className="contents">
        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[26px]">Division fees & age rules</h2>
              <TableWrap>
                <DataTable>
                  <TableHead>
                    <tr>
                      <HeadCell>Division</HeadCell>
                      <HeadCell>Fee</HeadCell>
                      <HeadCell>Born on or before</HeadCell>
                      <HeadCell>Gender</HeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {divisions.map((d) => (
                      <BodyRow key={d.id}>
                        <BodyCell className="whitespace-nowrap">
                          <b>{d.name}</b>
                        </BodyCell>
                        <BodyCell>
                          <input form="settings-save" name={`fee-${d.id}`} className={`${small} w-24 min-w-24`} defaultValue={money(d.fee)} inputMode="decimal" aria-label={`${d.name} fee`} />
                        </BodyCell>
                        <BodyCell>
                          {d.menCutoff || d.womenCutoff ? (
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-2 text-xs text-muted">
                                <span className="w-11">Men</span>
                                <input form="settings-save" name={`men-${d.id}`} type="date" className={`${small} w-[160px]`} defaultValue={d.menCutoff ?? ""} aria-label={`${d.name} men cutoff`} />
                              </label>
                              <label className="flex items-center gap-2 text-xs text-muted">
                                <span className="w-11">Women</span>
                                <input form="settings-save" name={`women-${d.id}`} type="date" className={`${small} w-[160px]`} defaultValue={d.womenCutoff ?? ""} aria-label={`${d.name} women cutoff`} />
                              </label>
                            </div>
                          ) : (
                            <input form="settings-save" name={`cutoff-${d.id}`} type="date" className={`${small} w-[160px]`} defaultValue={d.cutoff ?? ""} aria-label={`${d.name} cutoff`} />
                          )}
                        </BodyCell>
                        <BodyCell className="text-[13px] whitespace-nowrap">{d.gender}</BodyCell>
                      </BodyRow>
                    ))}
                    <BodyRow>
                      <BodyCell className="whitespace-nowrap">
                        <b>Game pass</b>
                        <div className="text-xs text-muted">All divisions · one match</div>
                      </BodyCell>
                      <BodyCell>
                        <input form="settings-save" name="gamePassFee" className={`${small} w-24 min-w-24`} defaultValue={money(gamePassFee)} inputMode="decimal" aria-label="Game pass fee" />
                      </BodyCell>
                      <BodyCell className="text-[13px] text-muted">Uses the match’s division rule</BodyCell>
                      <BodyCell />
                    </BodyRow>
                  </TableBody>
                </DataTable>
              </TableWrap>
            </section>

            <section className="flex flex-col gap-2.5">
              <h2 className="text-[26px]">Discount codes</h2>
              <TableWrap>
                <DataTable>
                  <TableHead>
                    <tr>
                      <HeadCell>Code</HeadCell>
                      <HeadCell>Type</HeadCell>
                      <HeadCell>Value</HeadCell>
                      <HeadCell>Used</HeadCell>
                      <HeadCell>Status</HeadCell>
                      <HeadCell align="right">
                        <span className="sr-only">Change</span>
                      </HeadCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {discountCodes.map((c) => (
                      <BodyRow key={c.id}>
                        <BodyCell className="font-mono font-bold">{c.code}</BodyCell>
                        <BodyCell className="whitespace-nowrap">{c.kind}</BodyCell>
                        <BodyCell className="whitespace-nowrap">{c.value}</BodyCell>
                        <BodyCell className="whitespace-nowrap tabular-nums">{c.uses}</BodyCell>
                        <BodyCell>{c.active ? <Badge tone="ok">Active</Badge> : <Badge>Expired</Badge>}</BodyCell>
                        <BodyCell align="right" className="whitespace-nowrap">
                          <Button variant="link" size="sm" disabled={pending} onClick={() => run(() => setDiscountCodeActive({ id: c.id, active: !c.active }))}>
                            {c.active ? "Turn off" : "Turn on"}
                          </Button>
                          {!c.used ? (
                            <Button variant="link" size="sm" className="ml-3 text-bad" disabled={pending} onClick={() => run(() => deleteDiscountCode({ id: c.id }))}>
                              Delete
                            </Button>
                          ) : null}
                        </BodyCell>
                      </BodyRow>
                    ))}
                  </TableBody>
                </DataTable>
              </TableWrap>
              <form onSubmit={addCode} className="flex flex-wrap items-end gap-2" aria-label="Add a discount code">
                <input className={`${small} w-36 font-mono uppercase`} placeholder="CODE" value={code.code} onChange={(e) => setCode({ ...code, code: e.target.value })} aria-label="New code" />
                <select className={`${small} w-auto`} value={code.kind} onChange={(e) => setCode({ ...code, kind: e.target.value })} aria-label="Code type">
                  <option value="PROMO">Promo</option>
                  <option value="BOARD">Board member</option>
                  <option value="TEAM_PAID">Team paid in full</option>
                </select>
                {code.kind === "TEAM_PAID" ? (
                  <select className={`${small} w-auto`} value={code.teamId} onChange={(e) => setCode({ ...code, teamId: e.target.value })} aria-label="Team that paid">
                    <option value="">Team…</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select className={`${small} w-auto`} value={code.type} onChange={(e) => setCode({ ...code, type: e.target.value })} aria-label="Discount unit">
                  <option value="AMOUNT">$ off</option>
                  <option value="PERCENT">% off</option>
                </select>
                <input className={`${small} w-20`} placeholder="Value" inputMode="decimal" value={code.value} onChange={(e) => setCode({ ...code, value: e.target.value })} aria-label="Discount value" />
                <input className={`${small} w-24`} placeholder="Max uses" inputMode="numeric" value={code.maxUses} onChange={(e) => setCode({ ...code, maxUses: e.target.value })} aria-label="Max uses" />
                <Button type="submit" variant="ghost" size="sm" className="!min-h-10" disabled={pending}>
                  Add code
                </Button>
              </form>
              {codeError ? <span className="text-[12.5px] font-semibold text-bad">{codeError}</span> : null}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-[18px]">
            <Card className="flex flex-col gap-3">
              <h3 className="text-[19px] font-bold">Eligible area</h3>
              <CheckRow checked={fairfax} onChange={(v) => !readOnly && setFairfax(v)} title="Fairfax County" sub="Any address in the county" />
              <div className="flex flex-col gap-2">
                <span className="text-[13.5px] font-bold">Also allowed ZIP codes</span>
                {zips.length ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {zips.map((z) => (
                      <li key={z} className="inline-flex h-8 items-center gap-1 rounded-full bg-neutral-bg pr-1 pl-3 text-[13px] font-bold">
                        {z}
                        <button
                          type="button"
                          aria-label={`Remove ${z}`}
                          className="grid size-6 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-fg"
                          disabled={pending}
                          onClick={() => run(() => removeAllowedZip({ zip: z }), () => setZips(zips.filter((x) => x !== z)))}
                        >
                          <Icon name="x" className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-[13px] text-muted">No extra ZIP codes.</span>
                )}
                <form onSubmit={addZip} className="flex gap-2">
                  <input
                    className={`${small} flex-1`}
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder="Add ZIP"
                    inputMode="numeric"
                    maxLength={5}
                    aria-label="Add ZIP code"
                    aria-invalid={!!zipError}
                  />
                  <Button type="submit" variant="ghost" size="sm" className="!min-h-10">
                    Add
                  </Button>
                </form>
                {zipError ? <span className="text-[12.5px] font-semibold text-bad">{zipError}</span> : null}
              </div>
              <p className="text-xs text-muted">Registrations from other ZIP codes still go through but are flagged for review.</p>
            </Card>

            <Card className="flex flex-col gap-3">
              <h3 className="text-[19px] font-bold">Email blocklist</h3>
              <p className="text-[13px] text-muted">Registrations from these addresses or domains are held automatically.</p>
              {block.length ? (
                <ul className="flex flex-col overflow-hidden rounded-[var(--radius-field)] border border-line">
                  {block.map((b) => (
                    <li key={b} className="flex min-h-11 items-center gap-3 border-b border-line px-3.5 last:border-b-0">
                      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">{b}</span>
                      <button
                        type="button"
                        disabled={pending}
                        className="min-h-11 text-[13px] font-bold text-bad underline underline-offset-4"
                        onClick={() => run(() => removeBlock({ entry: b }), () => setBlock(block.filter((x) => x !== b)))}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[13px] text-muted">No blocked addresses.</span>
              )}
              <form onSubmit={addBlockEntry} className="flex gap-2">
                <input
                  className={`${small} flex-1`}
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="email or domain"
                  aria-label="Add to blocklist"
                  aria-invalid={!!blockError}
                />
                <Button type="submit" variant="ghost" size="sm" className="!min-h-10">
                  Add
                </Button>
              </form>
              {blockError ? <span className="text-[12.5px] font-semibold text-bad">{blockError}</span> : null}
            </Card>
          </div>
        </div>
      </fieldset>
      <Toast message={toast} />
    </>
  );
}
