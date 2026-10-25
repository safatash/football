import { describe, expect, it } from "vitest";
import { csvCells, parseDate, parseScheduleCsv, parseTime } from "@/lib/schedule-csv";

describe("schedule CSV", () => {
  it("splits cells with quotes, commas inside quotes and CRLF", () => {
    expect(csvCells('a,"b, c","d ""e"""\r\n1,2,3\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });

  it("reads ISO and US dates, 24-hour and am/pm times", () => {
    expect(parseDate("2026-09-06")).toBe("2026-09-06");
    expect(parseDate("9/6/2026")).toBe("2026-09-06");
    expect(parseDate("2/30/2026")).toBeNull();
    expect(parseTime("18:30")).toBe("18:30");
    expect(parseTime("6:30 pm")).toBe("18:30");
    expect(parseTime("12:05am")).toBe("00:05");
    expect(parseTime("25:00")).toBeNull();
  });

  it("maps columns by header name in any order, and reports bad lines with their line number", () => {
    const csv = ["Home,Away,Date,Time,Field,Game #", "Fairfax United,Bloodline,9/6/2026,9:00 am,Wakefield Park 3,301", "A,B,someday,10:00,,", "C,,2026-09-06,10:00,,x"].join("\n");
    const { rows, errors } = parseScheduleCsv(csv);
    expect(rows).toEqual([{ line: 2, date: "2026-09-06", time: "09:00", home: "Fairfax United", away: "Bloodline", field: "Wakefield Park 3", division: null, gameNumber: 301 }]);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
    expect(errors[1].message).toMatch(/no away team.*game number/);
  });

  it("needs the required columns", () => {
    expect(parseScheduleCsv("date,home,away\n2026-09-06,A,B").errors[0].message).toMatch(/missing: time/);
    expect(parseScheduleCsv("").errors[0].message).toMatch(/empty/);
  });
});
