/**
 * CSV schedule import (pure parsing; the action matches teams and fields and saves).
 *
 * A header row names the columns, in any order and case:
 *   date, time, home, away       required
 *   field, division, game        optional ("field" is "Park Field", e.g. "Wakefield Park 3")
 * Dates: 2026-09-06 or 9/6/2026. Times: 18:30, 6:30 pm or 6:30pm.
 */

export type CsvMatchRow = { line: number; date: string; time: string; home: string; away: string; field: string | null; division: string | null; gameNumber: number | null };
export type CsvParse = { rows: CsvMatchRow[]; errors: { line: number; message: string }[] };

/** Splits CSV text into rows of cells (quotes, doubled quotes and CRLF handled). */
export function csvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

export function parseDate(v: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(v);
  const [y, m, d] = iso ? [+iso[1], +iso[2], +iso[3]] : us ? [us[3].length === 2 ? 2000 + +us[3] : +us[3], +us[1], +us[2]] : [0, 0, 0];
  if (!y) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

export function parseTime(v: string): string | null {
  const t = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(v.trim());
  if (!t) return null;
  let h = +t[1];
  const min = +t[2];
  const ampm = t[3]?.toLowerCase();
  if (ampm) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ampm === "pm" ? 12 : 0);
  }
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

const REQUIRED = ["date", "time", "home", "away"] as const;
export const MAX_IMPORT_ROWS = 500;

export function parseScheduleCsv(text: string): CsvParse {
  const all = csvCells(text).filter((r) => r.some((c) => c !== ""));
  const errors: CsvParse["errors"] = [];
  if (!all.length) return { rows: [], errors: [{ line: 1, message: "The file is empty." }] };
  const header = all[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const col = (name: string) => header.indexOf(name === "game" ? (header.includes("game") ? "game" : "gamenumber") : name);
  const missing = REQUIRED.filter((c) => col(c) < 0);
  if (missing.length) return { rows: [], errors: [{ line: 1, message: `Add a header row with ${REQUIRED.join(", ")} (missing: ${missing.join(", ")}).` }] };
  if (all.length - 1 > MAX_IMPORT_ROWS) return { rows: [], errors: [{ line: 1, message: `Import at most ${MAX_IMPORT_ROWS} matches at a time.` }] };

  const rows: CsvMatchRow[] = [];
  all.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const date = parseDate(get("date"));
    const time = parseTime(get("time"));
    const [home, away] = [get("home"), get("away")];
    const game = get("game");
    const problems = [
      !date && `date “${get("date")}” isn’t a date`,
      !time && `time “${get("time")}” isn’t a time`,
      !home && "no home team",
      !away && "no away team",
      game && !/^\d{1,6}$/.test(game) && `game number “${game}” isn’t a number`,
    ].filter(Boolean);
    if (problems.length) errors.push({ line, message: problems.join("; ") });
    else rows.push({ line, date: date!, time: time!, home, away, field: get("field") || null, division: get("division") || null, gameNumber: game ? Number(game) : null });
  });
  return { rows, errors };
}
