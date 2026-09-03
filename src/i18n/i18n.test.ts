/* Translations. Key parity is now a matter of types: Catalogue is derived
   from fi.ts, so a missing key does not compile. These tests cover what the
   type cannot see: placeholders, list lengths, the data-table rows, and that no
   Finnish has leaked into the code. */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { BOSSES, CONSUMABLES, ENH, JOKERS, PARTIES, VOUCHERS } from "../game/content";
import { SM, TYPES } from "../game/constants";
import {
  LOCALES,
  LOCALE_ORDER,
  descOfIn,
  formatNumber,
  nameOfIn,
  seatNameIn,
  translate,
  translateList,
  translateRaw,
} from ".";
import { en } from "./en";
import { fi } from "./fi";

const ROOT = join(import.meta.dirname, "..", "..");

/* Every source file except the catalogues and the tests. */
function sourceFiles(dir = join(ROOT, "src"), out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(e.name) && !p.includes("i18n") && !/\.test\.tsx?$/.test(e.name))
      out.push(p);
  }
  return out;
}
const SOURCES = sourceFiles();
const ALL_SOURCE = SOURCES.map((f) => readFileSync(f, "utf8")).join("\n");

describe("catalogue parity", () => {
  const fiKeys = Object.keys(fi);
  const enKeys = Object.keys(en);

  it("holds the same keys in both languages", () => {
    expect(enKeys.sort()).toEqual(fiKeys.sort());
    expect(fiKeys.length).toBeGreaterThan(300);
  });

  /* A placeholder present in one language and missing from the other renders
     as literal {braces}. */
  it("uses the same placeholders in both languages", () => {
    const vars = (s: string | string[]) => (String(s).match(/\{(\w+)\}/g) ?? []).sort().join(",");
    const mismatched = fiKeys.filter(
      (k) =>
        typeof fi[k as keyof typeof fi] === "string" &&
        vars(fi[k as keyof typeof fi]) !== vars(en[k as keyof typeof en]),
    );
    expect(mismatched).toEqual([]);
  });

  it("keeps list keys as lists of equal length", () => {
    const listKeys = fiKeys.filter((k) => Array.isArray(fi[k as keyof typeof fi]));
    expect(listKeys.length).toBeGreaterThanOrEqual(2);
    for (const k of listKeys) {
      const a = fi[k as keyof typeof fi] as string[];
      const b = en[k as keyof typeof en] as string[];
      expect(Array.isArray(b)).toBe(true);
      expect(b).toHaveLength(a.length);
    }
  });

  it("returns an empty list for a plain string key or an unknown one", () => {
    expect(translateList("fi", "rules.title")).toEqual([]);
    expect(translateList("fi", "no.such.list")).toEqual([]);
    expect(translateList("en", "rules.tuppi").length).toBeGreaterThan(0);
  });
});

/* Data-table rows build their own keys (joker.ramikone + ".n"), so the type
   cannot check them. This test can. */
describe("data tables resolve through the catalogue", () => {
  const rows = [
    ...JOKERS,
    ...CONSUMABLES,
    ...VOUCHERS,
    ...BOSSES,
    ...PARTIES,
    ...Object.values(ENH),
  ];

  it.each(LOCALE_ORDER)("resolves every row in %s", (loc) => {
    const noName = rows.filter((x) => nameOfIn(loc, x) === x.key + ".n");
    const noDesc = rows.filter((x) => descOfIn(loc, x) === x.key + ".t");
    expect(noName.map((x) => x.key)).toEqual([]);
    expect(noDesc.map((x) => x.key)).toEqual([]);
  });

  it.each(LOCALE_ORDER)("names every trick type, suit and blind in %s", (loc) => {
    for (const ty of Object.values(TYPES))
      expect(translate(loc, `type.${ty.id}`)).not.toBe(`type.${ty.id}`);
    for (const s of Object.keys(SM)) expect(translateRaw(loc, `suit.${s}`)).not.toBe(`suit.${s}`);
    for (const s of Object.keys(SM))
      expect(translateRaw(loc, `suitPart.${s}`)).not.toBe(`suitPart.${s}`);
    for (const i of [0, 1, 2]) expect(translateRaw(loc, `blind.${i}`)).not.toBe(`blind.${i}`);
  });

  it.each(LOCALE_ORDER)("localises only the player's own seat in %s", (loc) => {
    expect(seatNameIn(loc, 1)).toBe("Raimo");
    expect(seatNameIn(loc, 2)).toBe("Veikko");
    expect(seatNameIn(loc, 3)).toBe("Sirpa");
    expect(seatNameIn(loc, 0)).toBe(loc === "fi" ? "Sinä" : "You");
  });
});

/* Keys the code assembles at runtime: toasts, the tuppi multiplier's
   explanation and the sooli verdict. The type cannot see these, so they are
   checked against the source text. */
describe("dynamically built keys exist", () => {
  it.each(LOCALE_ORDER)("resolves every toast, need and verdict key in %s", (loc) => {
    const keys = new Set<string>();
    for (const m of ALL_SOURCE.matchAll(/"((?:toast|need|sooli)\.[A-Za-z]+)"/g)) keys.add(m[1]);
    expect(keys.size).toBeGreaterThan(20);
    const missing = [...keys].filter((k) => translateRaw(loc, k) === k);
    expect(missing).toEqual([]);
  });
});

describe("substitution and formatting", () => {
  it("fills placeholders and leaves missing ones visible", () => {
    expect(translate("en", "table.cardCount", { n: 7 })).toBe("7 cards");
    expect(translate("en", "table.cardCount", {})).toContain("{n}");
    expect(translateRaw("en", "no.such.key")).toBe("no.such.key");
  });

  it("groups thousands per language", () => {
    expect(formatNumber("en", 1616)).toBe("1,616");
    expect(formatNumber("fi", 1616)).not.toContain(",");
    expect(formatNumber("fi", 1616)).not.toBe("1616");
  });

  it("offers exactly the two locales", () => {
    expect(Object.keys(LOCALES)).toEqual(["fi", "en"]);
  });
});

/* Every player-facing string lives in src/i18n/. A Finnish literal elsewhere
   in src/ means something was missed in the conversion. A diacritic search is
   not enough on its own — "palkkio", "tavoite" and "Panos" all survived three
   separate ä/ö sweeps — but it is cheap and catches most of it. */
describe("Finnish prose lives only in the catalogue", () => {
  it("has no Finnish string literal elsewhere in src/", () => {
    const offenders: string[] = [];
    for (const f of SOURCES) {
      const body = readFileSync(f, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      for (const m of body.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)) {
        const s = m[1] ?? m[2] ?? "";
        if (/[äöÄÖ]/.test(s)) offenders.push(`${relative(ROOT, f)}: "${s.slice(0, 40)}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* Party names are invented on purpose: the game would otherwise be putting
   words in a real organisation's mouth. */
describe("no invented party is a real one", () => {
  const BLOCKED = [
    "sdp",
    "kokoomus",
    "kok",
    "perussuomalaiset",
    "ps",
    "keskusta",
    "kesk",
    "vihreät",
    "vihreat",
    "vihr",
    "vasemmistoliitto",
    "vas",
    "rkp",
    "kd",
    "liike nyt",
  ];

  it.each(LOCALE_ORDER)("invents every party name in %s", (loc) => {
    const names = PARTIES.map((p) => nameOfIn(loc, p).toLowerCase());
    const hits = names.filter((n) => BLOCKED.some((b) => n.includes(b)));
    expect(hits).toEqual([]);
  });

  /* The emblems are the abbreviation-shaped half, and they are data rather
     than catalogue values, so they are checked against PARTIES. */
  it("uses no real abbreviation as an emblem", () => {
    const hits = PARTIES.filter((p) => BLOCKED.includes(p.g.toLowerCase()));
    expect(hits.map((p) => p.id)).toEqual([]);
  });

  it("translates the party names rather than repeating the Finnish", () => {
    const same = PARTIES.filter((p) => nameOfIn("fi", p) === nameOfIn("en", p));
    expect(same.map((p) => p.id)).toEqual([]);
  });

  it.each(LOCALE_ORDER)("fills the rules panel's parties list in %s", (loc) => {
    expect(translateList(loc, "rules.parties").length).toBeGreaterThan(0);
  });
});
