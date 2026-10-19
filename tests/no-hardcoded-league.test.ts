/** League names, emails and links come from the organization, not the code (Phase 3). */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|css)$/.test(f) ? [p] : [];
  });

// The importer for NVASA's old site, and the id constant for NVASA's row
const ALLOWED = new Set(["src/lib/legacy-import.ts", "src/lib/org.ts"]);

describe("no hard-coded league", () => {
  it("app code doesn't name NVASA or use its addresses", () => {
    const hits: string[] = [];
    for (const p of files(join(root, "src"))) {
      const path = relative(root, p);
      if (ALLOWED.has(path)) continue;
      readFileSync(p, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const code = line.replace(/NVASA_ORG_ID|NVASA_NOW/g, "");
          // Comments may use NVASA as an example
          if (/^\s*(\/\/|\*|\/\*)/.test(code)) return;
          if (/NVASA|nvasa\.org|groups\/nvasa|twitter\.com\/NVASA/i.test(code)) hits.push(`${path}:${i + 1}: ${line.trim().slice(0, 80)}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
