import { describe, expect, it } from "vitest";
import { buildCalendar, icsEscape, icsFold } from "@/lib/ics";
import { directionsUrl, gameNo, outcomeFor, placeLabel, scoreLabel, seasonSlug } from "@/lib/public";

describe("game numbers", () => {
  it("pads to three digits for display", () => {
    expect(gameNo(7)).toBe("#007");
    expect(gameNo(42)).toBe("#042");
    expect(gameNo(204)).toBe("#204");
    expect(gameNo(1204)).toBe("#1204");
  });
});

describe("places and scores", () => {
  it("labels fields and builds directions links", () => {
    const f = { complex: "Wakefield Park", name: "3", city: "Annandale", state: "VA" };
    expect(placeLabel(f)).toBe("Wakefield Park · Field 3 · Annandale");
    expect(directionsUrl(f)).toBe("https://www.google.com/maps/search/?api=1&query=Wakefield%20Park%2C%20Annandale%2C%20VA");
    expect(directionsUrl({ complex: "Lee District", address: "6601 Telegraph Rd", city: "Alexandria", state: "VA", zip: "22310" })).toContain("6601%20Telegraph%20Rd%2C%20Alexandria%2C%20VA%2C%2022310");
    expect(directionsUrl(null, "")).toBeNull();
  });
  it("describes results in words", () => {
    expect(outcomeFor(2, 0)).toBe("W");
    expect(outcomeFor(1, 1)).toBe("D");
    expect(outcomeFor(0, 3)).toBe("L");
    expect(scoreLabel("Burke Athletic", "Fairfax United", 0, 2)).toBe("Fairfax United won 2 to 0 against Burke Athletic");
    expect(scoreLabel("A", "B", 2, 2)).toBe("A and B drew 2 to 2");
  });
  it("slugs seasons", () => {
    expect(seasonSlug("Spring 2026")).toBe("spring-2026");
    expect(seasonSlug("Fall 2025 ")).toBe("fall-2025");
  });
});

describe("calendar (.ics)", () => {
  const start = new Date("2026-05-17T13:00:00Z"); // 9:00 AM EDT
  const ics = buildCalendar("Fairfax United, Spring 2026", [
    { uid: "match-abc@nvasa.org", start, summary: "Game No: 204 - Fairfax United Vs Alexandria FC", location: "Wakefield Park - 3 - Annandale, VA" },
    { uid: "match-def@nvasa.org", start: new Date("2026-11-08T15:00:00Z"), summary: "Winter; test, with \\ backslash" },
  ], new Date("2026-05-01T00:00:00Z"));

  it("is a valid calendar with CRLF line endings", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("BEGIN:VTIMEZONE\r\nTZID:America/New_York");
  });
  it("uses New York local times and 90-minute events, with stable UIDs", () => {
    expect(ics).toContain("UID:match-abc@nvasa.org");
    expect(ics).toContain("DTSTART;TZID=America/New_York:20260517T090000");
    expect(ics).toContain("DTEND;TZID=America/New_York:20260517T103000");
    // Standard time in November
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261108T100000");
    expect(ics).toContain("DTSTAMP:20260501T000000Z");
  });
  it("escapes text", () => {
    expect(ics).toContain("LOCATION:Wakefield Park - 3 - Annandale\\, VA");
    expect(ics).toContain("SUMMARY:Winter\; test\\, with \\\\ backslash");
    expect(icsEscape("a\nb")).toBe("a\\nb");
  });
  it("folds lines over 75 octets", () => {
    const folded = icsFold(`SUMMARY:${"x".repeat(200)}`);
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n").slice(1).every((l) => l.startsWith(" "))).toBe(true);
  });
});
