"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { PageHeading } from "@/components/league";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckRow, Toast, useToast } from "@/components/ui/controls";
import { inputClass } from "@/components/ui/field";
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
  divisions,
  gamePassFee,
  discountCodes,
  fairfaxCountyAllowed,
  zips: initialZips,
  blocklist: initialBlock,
  readOnly,
  notice,
}: {
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

  function addZip(e: FormEvent) {
    e.preventDefault();
    const z = zip.trim();
    if (!/^\d{5}$/.test(z)) return setZipError("Enter a 5-digit ZIP code.");
    if (zips.includes(z)) return setZipError(`${z} is already allowed.`);
    setZips([...zips, z].sort());
    setZip("");
    setZipError("");
  }

  function addBlock(e: FormEvent) {
    e.preventDefault();
    const v = entry.trim().toLowerCase();
    if (!/^(\*@)?[^\s@]+(@[^\s@]+)?\.[^\s@]+$/.test(v)) return setBlockError("Enter an email address or a domain.");
    if (block.includes(v)) return setBlockError(`${v} is already blocked.`);
    setBlock([v, ...block]);
    setEntry("");
    setBlockError("");
  }

  return (
    <>
      <PageHeading
        title="Fees & eligibility"
        sub="Season pricing, discount codes and who can register"
        actions={
          <Button variant="primary" size="sm" disabled={readOnly} onClick={() => showToast("Saving settings isn’t available yet")}>
            Save changes
          </Button>
        }
      />
      {notice}

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
                          <input className={`${small} w-24`} defaultValue={money(d.fee)} inputMode="decimal" aria-label={`${d.name} fee`} />
                        </BodyCell>
                        <BodyCell>
                          {d.menCutoff || d.womenCutoff ? (
                            <div className="flex flex-col gap-1">
                              <label className="flex items-center gap-2 text-xs text-muted">
                                <span className="w-11">Men</span>
                                <input type="date" className={`${small} w-[160px]`} defaultValue={d.menCutoff ?? ""} aria-label={`${d.name} men cutoff`} />
                              </label>
                              <label className="flex items-center gap-2 text-xs text-muted">
                                <span className="w-11">Women</span>
                                <input type="date" className={`${small} w-[160px]`} defaultValue={d.womenCutoff ?? ""} aria-label={`${d.name} women cutoff`} />
                              </label>
                            </div>
                          ) : (
                            <input type="date" className={`${small} w-[160px]`} defaultValue={d.cutoff ?? ""} aria-label={`${d.name} cutoff`} />
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
                        <input className={`${small} w-24`} defaultValue={money(gamePassFee)} inputMode="decimal" aria-label="Game pass fee" />
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
                      </BodyRow>
                    ))}
                  </TableBody>
                </DataTable>
              </TableWrap>
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
                          onClick={() => setZips(zips.filter((x) => x !== z))}
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
                      <button type="button" className="min-h-11 text-[13px] font-bold text-bad underline underline-offset-4" onClick={() => setBlock(block.filter((x) => x !== b))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[13px] text-muted">No blocked addresses.</span>
              )}
              <form onSubmit={addBlock} className="flex gap-2">
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
