/* Translations. Key parity is now a matter of types: Catalogue is derived
   from fi.ts, so a missing key does not compile. These tests cover what the
   type cannot see: placeholders, list lengths, the data-table rows, and that no
   Finnish has leaked into the code. */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { BOSSES, CHALLENGES, CONSUMABLES, ENH, JOKERS, PARTIES, VOUCHERS } from "../game/content";
import { BLIND_KEYS, SM, TYPES } from "../game/constants";
import {
  LOCALES,
  LOCALE_ORDER,
  descOfIn,
  emblemOfIn,
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

  /* The session line's two halves: the host's counts the chairs that answered
     and the guest's carries no number, because a guest's chairs are never
     patched and any count it printed would be invented. */
  it("counts chairs in the hosting line and nowhere else", () => {
    for (const cat of [fi, en]) {
      expect(cat["multi.hosting"]).toContain("{n}");
      expect(cat["multi.joined"]).not.toContain("{n}");
      expect(String(cat["multi.joined"])).not.toMatch(/\{\w+\}/);
    }
  });

  /* Host-versus-answer is protocol jargon, and net.bad.kind exists precisely
     because players cross those two up. The vocabulary is retired, so a
     catalogue value that still speaks it is drift the type cannot see — and
     the two codes are named by side now, not by kind. */
  it("keeps the retired invitation vocabulary out of both catalogues", () => {
    /* Spelled in halves on purpose. The criterion that retired these words
       greps src/i18n/ for them, and a test that writes them out is a hit of
       its own — the grep would then never come back empty however clean the
       two catalogues are. */
    const koodi = "koodi";
    const code = "code";
    const retired = new RegExp(
      [`kutsu${koodi}`, `vastaus${koodi}`, `invitation ${code}`, `answer ${code}`].join("|"),
      "i",
    );
    for (const [name, cat] of [
      ["fi", fi],
      ["en", en],
    ] as const) {
      const spoken = Object.entries(cat).filter(([, v]) => retired.test(String(v)));
      expect(spoken.map(([k]) => `${name}:${k}`)).toEqual([]);
    }
    for (const loc of LOCALE_ORDER) {
      expect(translate(loc, "net.bad.kind")).toMatch(loc === "fi" ? /puolesi/ : /own side/);
      expect(translate(loc, "lobby.yourCode")).toBe(loc === "fi" ? "Koodisi" : "Your code");
      expect(translate(loc, "lobby.theirCode")).toBe(loc === "fi" ? "Toisen koodi" : "Their code");
    }
  });

  /* The rules panel teaches the route to use, so its first multiplayer entry
     leads with the room and names the code swap as what sits one level down.
     Five entries in both languages, because the panel's list lengths have to
     match, and every emphasis still goes through <Rich>. The fifth is the
     shared table, which joins by either route. */
  it("leads the multiplayer rules with the room and names the code swap", () => {
    for (const loc of LOCALE_ORDER) {
      const mp = translateList(loc, "rules.mp");
      expect(mp).toHaveLength(5);
      const room = loc === "fi" ? "Avaa huone" : "Open a room";
      const swap = loc === "fi" ? "koodien vaihto" : "code swap";
      const ways = loc === "fi" ? "Muut yhteystavat" : "Other ways to connect";
      expect(mp[0]).toContain(room);
      expect(mp[0].toLowerCase()).toContain(swap.toLowerCase());
      expect(mp[0]).toContain(ways);
      /* Room first: the entry names the route to use before the one behind
         the link, not the other way round. */
      expect(mp[0].indexOf(room)).toBeLessThan(mp[0].toLowerCase().indexOf(swap.toLowerCase()));
      /* The demoted route is no longer named after hosting. */
      expect(mp[0]).not.toContain(translate(loc, "btn.hostGame"));
      /* LAN only belongs to the code swap, and says so where it is mentioned. */
      expect(mp[1].toLowerCase()).toContain(swap.toLowerCase());
      expect(mp[1].toLowerCase()).toContain(translate(loc, "lobby.lan").toLowerCase());
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
    ...CHALLENGES,
    ...Object.values(ENH),
  ];

  it.each(LOCALE_ORDER)("resolves every row in %s", (loc) => {
    const noName = rows.filter((x) => nameOfIn(loc, x) === x.key + ".n");
    const noDesc = rows.filter((x) => descOfIn(loc, x) === x.key + ".t");
    expect(noName.map((x) => x.key)).toEqual([]);
    expect(noDesc.map((x) => x.key)).toEqual([]);
    /* Only the parties have a catalogue emblem — every other table keeps its
       `g` as a language-neutral glyph in content.ts — so the `.g` half of this
       check is scoped to PARTIES rather than to every row. */
    const noEmblem = PARTIES.filter((p) => emblemOfIn(loc, p) === p.key + ".g");
    expect(noEmblem.map((p) => p.key)).toEqual([]);
  });

  it.each(LOCALE_ORDER)("names every trick type, suit and blind in %s", (loc) => {
    for (const ty of Object.values(TYPES))
      expect(translate(loc, `type.${ty.id}`)).not.toBe(`type.${ty.id}`);
    for (const s of Object.keys(SM)) expect(translateRaw(loc, `suit.${s}`)).not.toBe(`suit.${s}`);
    for (const s of Object.keys(SM))
      expect(translateRaw(loc, `suitPart.${s}`)).not.toBe(`suitPart.${s}`);
    for (const k of BLIND_KEYS) expect(translateRaw(loc, k)).not.toBe(k);
  });

  it.each(LOCALE_ORDER)("localises only the player's own seat in %s", (loc) => {
    expect(seatNameIn(loc, 1, 0)).toBe("Raimo");
    expect(seatNameIn(loc, 2, 0)).toBe("Veikko");
    expect(seatNameIn(loc, 3, 0)).toBe("Sirpa");
    expect(seatNameIn(loc, 0, 0)).toBe(loc === "fi" ? "Sinä" : "You");
  });

  /* The "you" string follows the window, not seat 0: the lobby seats the
     player anywhere, and seat 0's chair then belongs to its own character. */
  it.each(LOCALE_ORDER)("names the seat the window is at in %s", (loc) => {
    expect(seatNameIn(loc, 2, 2)).toBe(loc === "fi" ? "Sinä" : "You");
    expect(seatNameIn(loc, 0, 2)).toBe("Seija");
    expect(seatNameIn(loc, 1, 2)).toBe("Raimo");
    expect(seatNameIn(loc, 3, 2)).toBe("Sirpa");
  });

  /* Exactly one of the four is the player, whichever chair they took: two
     would mean the character list and the viewer disagree, none would mean the
     player's own seat reads as a stranger. */
  it.each(LOCALE_ORDER)("calls exactly one seat 'you' from every chair in %s", (loc) => {
    const mine = loc === "fi" ? "Sinä" : "You";
    for (const you of [0, 1, 2, 3] as const) {
      const names = ([0, 1, 2, 3] as const).map((p) => seatNameIn(loc, p, you));
      expect(names.filter((n) => n === mine)).toEqual([mine]);
      expect(names[you]).toBe(mine);
      expect(new Set(names).size).toBe(4);
    }
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

  /* The emblems are the abbreviation-shaped half, and they are translated, so
     each locale gets its own set to answer for. */
  it.each(LOCALE_ORDER)("uses no real abbreviation as an emblem in %s", (loc) => {
    const hits = PARTIES.filter((p) => BLOCKED.includes(emblemOfIn(loc, p).toLowerCase()));
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

/* The emblem abbreviates a translated name, so it is player-facing text and
   lives in the catalogue rather than in content.ts. */
describe("party emblems", () => {
  it("leaves no emblem on a PARTIES row", () => {
    const src = readFileSync(join(ROOT, "src", "game", "content.ts"), "utf8");
    const table = /export const PARTIES: Party\[\] = \[([^\]]*)\]/.exec(src)?.[1];
    expect(table).toContain('id:"kahvi"');
    expect(table).not.toMatch(/\bg\s*:/);
  });

  it.each(LOCALE_ORDER)("prints thirteen distinct tofu-proof emblems in %s", (loc) => {
    const emblems = PARTIES.map((p) => emblemOfIn(loc, p));
    /* Letters and digits can never render as tofu, and two characters is what
       the card corner and the rail badge were laid out for. */
    for (const e of emblems) expect(e).toMatch(/^[A-Z0-9]{1,2}$/);
    /* A duplicate emblem would make both the card corner and the rail row
       ambiguous. */
    expect(new Set(emblems).size).toBe(13);
  });

  /* The defect this replaced: "KH" abbreviated Kahvipuolue, a word the English
     player never sees beside it. */
  it.each(LOCALE_ORDER)("abbreviates the name the player reads in %s", (loc) => {
    for (const p of PARTIES) {
      const emblem = emblemOfIn(loc, p);
      const name = nameOfIn(loc, p).toUpperCase();
      expect([p.id, emblem[0]]).toEqual([p.id, name[0]]);
      for (const ch of emblem) expect([p.id, name.includes(ch)]).toEqual([p.id, true]);
    }
  });

  /* The fix is additive: a Finnish player sees exactly what shipped. */
  it("keeps the Finnish emblems unchanged", () => {
    // prettier-ignore
    expect(PARTIES.map((p) => emblemOfIn("fi", p))).toEqual([
      "KH", "SN", "MK", "PK", "HK", "TV", "SU", "HN", "LK", "NU", "LT", "KL", "SM",
    ]);
  });
});
