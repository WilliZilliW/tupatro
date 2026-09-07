/* The boundaries that no single file shows. These keep the core testable
   without a browser and the timers in one place. */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const SRC = join(ROOT, "src");

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) filesUnder(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const ALL = filesUnder(SRC);
const APP = ALL.filter((f) => !/\.test\.tsx?$/.test(f) && !f.includes(`${"/"}test${"/"}`));
const read = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => relative(ROOT, f).split("\\").join("/");
const stripComments = (body: string) =>
  body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/* The pure core: takes state as a parameter, knows neither React nor the DOM.
   This is the boundary that lets the rule tests run without a browser. */
const PURE_CORE = [
  "src/game/cards.ts",
  "src/game/constants.ts",
  "src/game/content.ts",
  "src/game/rng.ts",
  "src/game/economy.ts",
  "src/game/rules.ts",
  "src/game/scoring.ts",
  "src/game/laydown.ts",
  "src/game/ai.ts",
  "src/game/shop.ts",
  "src/game/schedule.ts",
  "src/game/save.ts",
  "src/game/scores.ts",
  "src/game/types.ts",
  "src/game/actions.ts",
];

describe("the pure core", () => {
  it.each(PURE_CORE)("%s touches no DOM and no React", (f) => {
    const body = read(join(ROOT, f));
    expect(body).not.toMatch(/\bdocument\.|\bwindow\.|\blocalStorage\b/);
    expect(body).not.toMatch(/from "react/);
  });

  it.each(PURE_CORE)("%s does not import the store or the UI", (f) => {
    const body = read(join(ROOT, f));
    expect(body).not.toMatch(/from "\.\.?\/(hooks|components)/);
    expect(body).not.toMatch(/from "\.\/reducer"/);
  });

  it("keeps i18n out of the game logic", () => {
    /* Scoring returns a key rather than a finished sentence, so the core
       need not know any languages. */
    for (const f of filesUnder(join(SRC, "game"))) {
      if (/\.test\.tsx?$/.test(f)) continue;
      expect(read(f), `${rel(f)} imports i18n`).not.toMatch(/from "\.\.\/i18n/);
    }
  });

  it("keeps the game layer free of component imports", () => {
    for (const f of filesUnder(join(SRC, "game"))) {
      if (/\.test\.tsx?$/.test(f)) continue;
      expect(read(f), `${rel(f)} imports a component`).not.toMatch(/from "\.\.\/components/);
    }
  });
});

/* Persistence has one door on the game side, so a component cannot start
   writing storage of its own. src/i18n/index.ts is the other, unrelated site:
   it holds the locale preference, which is not part of a run and is not moved
   here. */
describe("persistence", () => {
  it("touches localStorage from storage.ts alone", () => {
    /* components/ is scanned too: the end screens read the scoreboard, and
       they read it through storage.ts like everything else. */
    const sites = APP.filter(
      (f) => /\/(game|hooks|components)\//.test(rel(f)) && /localStorage/.test(read(f)),
    );
    expect(sites.map(rel)).toEqual(["src/game/storage.ts"]);
  });

  it("removes a key from clearRun alone, and only the run's", () => {
    /* The scoreboard is a second key on purpose: a run that ends clears the
       snapshot and leaves the board. A stray removeItem is how that promise
       would break. */
    const sites = APP.filter((f) => /removeItem\(/.test(read(f)));
    expect(sites.map(rel)).toEqual(["src/game/storage.ts"]);
    const body = stripComments(read(join(ROOT, "src/game/storage.ts")));
    /* Any argument, not just an identifier: an inlined "tupatro-scores-v1"
       slipped straight past a \w+ capture, which then saw no call at all and
       compared an empty list against nothing. The count check below is what
       makes the capture's blindness impossible to repeat. */
    const calls = [...body.matchAll(/removeItem\(\s*([^)]*)\)/g)].map((m) => m[1].trim());
    expect(calls).toHaveLength((body.match(/removeItem\(/g) ?? []).length);
    expect(calls).toEqual(["RUN_KEY"]);
    expect(body).toMatch(/export function clearRun[\s\S]*?removeItem\(RUN_KEY\)/);
  });
});

/* One choke point for timers: the effect's cleanup cancels the timer when the
   step changes, so cancellation is not a separate concern. A second call site
   would mean a timer nothing cancels. */
describe("timers", () => {
  const sites = APP.filter((f) => /setTimeout\(/.test(read(f)));

  it("calls setTimeout from exactly one module", () => {
    expect(sites.map(rel)).toEqual(["src/hooks/useGameLoop.ts"]);
  });

  it("and that module cleans up after itself", () => {
    const body = read(join(ROOT, "src/hooks/useGameLoop.ts"));
    expect((body.match(/window\.setTimeout\(/g) ?? []).length).toBe(
      (body.match(/window\.clearTimeout\(/g) ?? []).length,
    );
  });
});

/* All randomness in the game logic goes through the seeded generator, so the
   same seed replays the same run. makeSeed is the one exception. */
describe("randomness", () => {
  it("uses Math.random in exactly one place", () => {
    const sites = APP.filter((f) => /Math\.random/.test(read(f)));
    expect(sites.map(rel)).toEqual(["src/game/rng.ts"]);
  });

  it("and only to draw a new seed", () => {
    const body = stripComments(read(join(ROOT, "src/game/rng.ts")));
    expect(body).toMatch(/export function makeSeed[\s\S]*?Math\.random/);
    expect((body.match(/Math\.random/g) ?? []).length).toBe(1);
  });

  it("does not consume randomness while rendering", () => {
    for (const f of APP.filter((f) => f.includes(`${"/"}components${"/"}`)))
      expect(read(f), `${rel(f)} draws randomness while rendering`).not.toMatch(
        /makeRng|\.next\(\)|Math\.random/,
      );
  });
});

/* The hand's raise is transform-only on purpose. #app gives the felt row
   minmax(0,1fr), so anything that grows .handrow takes height straight off the
   felt and the table jumps while the player is only looking at a card.
   filesUnder walks .ts/.tsx, so the stylesheet is read by path. */
describe("the hand card raise", () => {
  /* Properties that cannot reflow a sibling or a parent. */
  const SAFE = new Set([
    "transform",
    "transform-origin",
    "z-index",
    "box-shadow",
    "filter",
    "opacity",
    "outline",
    "cursor",
    "transition",
    "animation",
    "will-change",
  ]);
  const css = read(join(ROOT, "src/index.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  /* [^{}] never crosses a brace, so an @media wrapper is skipped and the rules
     inside it are matched on their own. */
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    sel: m[1].trim(),
    decls: m[2],
  }));
  const raises = rules.filter(
    (r) => r.sel.includes(".hcard") && /:hover|:focus-visible|\.dragging/.test(r.sel),
  );

  it("finds the raise rules at all", () => {
    /* A vacuous pass would be worse than no test: the hover, the keyboard
       focus and the drag are three separate rules today. */
    expect(raises.length).toBeGreaterThan(1);
  });

  it.each(raises.map((r) => [r.sel, r.decls]))(
    "%s declares nothing that reflows",
    (_sel, decls) => {
      const props = decls
        .split(";")
        .map((d) => d.split(":")[0].trim().toLowerCase())
        .filter(Boolean);
      expect(props.length).toBeGreaterThan(0);
      expect(props.filter((pr) => !SAFE.has(pr))).toEqual([]);
    },
  );
});

/* The viewport meta is the other half of the phone layout: the media queries
   are measured in CSS pixels, and without width=device-width a phone renders
   the page at 980px wide and scales it down, so none of them ever match.
   viewport-fit=cover is what makes env(safe-area-inset-*) report anything.
   filesUnder walks .ts/.tsx, so the document is read by path. */
describe("the viewport meta", () => {
  const html = read(join(ROOT, "index.html"));
  const content = /<meta name="viewport" content="([^"]*)"/.exec(html)?.[1] ?? "";

  it("declares the device width, no zoom of its own, and the safe area", () => {
    expect(content).toBe("width=device-width, initial-scale=1, viewport-fit=cover");
  });

  it("never blocks pinch zoom", () => {
    /* Blocking the browser's own zoom is an accessibility regression, and it
       is the cheap way out of every layout problem on a phone. */
    expect(content).not.toMatch(/user-scalable|maximum-scale/);
  });
});

describe("state", () => {
  it("has no module-level mutable state outside the store", () => {
    /* Everything mutable lives in the game state. A module-level `let` would
       be state the reducer cannot see and StrictMode does not tolerate. */
    for (const f of APP) {
      const body = stripComments(read(f));
      expect(body, `${rel(f)} declares module-level let`).not.toMatch(/^let\s/m);
    }
  });

  /* The viewing seat is a property of the window, not of the game. Under
     lockstep multiplayer every peer runs the same reducer over the same
     actions and every peer's state has to be byte-identical, so a "which seat
     am I" field would be the one field that differed — and the one that could
     desync a replay. It lives in a React context instead, which is why the
     pure core must not be able to reach it either.

     `localSeat` is on the list because it is the name that will actually be
     tried: the abandoned per-seat branch called it that and put it on the
     state, and its increments are what get ported onto this shape. A blocklist
     that misses the one name someone reaches for guards nothing. */
  const VIEW_SEAT_FIELDS = ["you", "viewSeat", "self", "me", "mySeat", "localSeat"];

  it("names no viewing seat in GameState, and keeps the context out of the core", () => {
    const types = read(join(ROOT, "src/game/types.ts"));
    const block = types.slice(types.indexOf("export type GameState = {"));
    const fields = [...block.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
    /* The scan has to find the fields at all: a types.ts whose GameState block
       moved or reindented would make the filter below vacuously empty. */
    expect(fields.length).toBeGreaterThan(30);
    expect(fields.filter((f) => VIEW_SEAT_FIELDS.includes(f))).toEqual([]);

    for (const f of filesUnder(join(SRC, "game"))) {
      if (/\.test\.tsx?$/.test(f)) continue;
      expect(read(f), `${rel(f)} imports the seat context`).not.toMatch(
        /from "\.\.\/hooks\/(seatContext|useSeat|SeatProvider)"/,
      );
    }
  });

  it("defines every state field in createRun", () => {
    /* No field is ever undefined. */
    const types = read(join(ROOT, "src/game/types.ts"));
    const block = types.slice(types.indexOf("export type GameState = {"));
    const fields = [...block.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
    const created = read(join(ROOT, "src/game/state.ts"));
    /* Shorthand (bestAnte,) counts as well as bestAnte: 0. */
    const missing = fields.filter((f) => !new RegExp(`\\b${f}\\s*[:,]`).test(created));
    expect(missing).toEqual([]);
    expect(fields.length).toBeGreaterThan(40);
  });

  /* ==================== the wallet is a seat's ====================
     The seventeen economy fields live in PlayerEconomy, one record per seat.
     Left at the top level of GameState they would be the run's again, and
     every pure function that now takes a seat could quietly stop needing
     one. */
  const ECONOMY_FIELDS = [
    "money",
    "jokers",
    "consumables",
    "vouchers",
    "jokerSlots",
    "consSlots",
    "shopSlots",
    "chipBonus",
    "tuppiBonus",
    "sideDeck",
    "sideSlots",
    "swaps",
    "swapsLeft",
    "usedSide",
    "shop",
    "shopAfterBoss",
    "rerollCost",
  ];

  /* PlayerEconomy is declared *before* GameState, so slicing from GameState's
     own declaration keeps the two blocks apart — the field scans below would
     otherwise read one another's fields. */
  const typesFile = () => read(join(ROOT, "src/game/types.ts"));
  const blockOf = (body: string, decl: string) => {
    const from = body.indexOf(decl);
    expect(from, `${decl} not found in types.ts`).toBeGreaterThan(-1);
    const rest = body.slice(from);
    return rest.slice(0, rest.indexOf("\n};"));
  };

  it("names no economy field at the top level of GameState", () => {
    const block = blockOf(typesFile(), "export type GameState = {");
    const fields = [...block.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
    expect(fields.length).toBeGreaterThan(30);
    expect(fields).toContain("economies");
    expect(fields.filter((f) => ECONOMY_FIELDS.includes(f))).toEqual([]);
  });

  /* The seventeen would otherwise leave the createRun invariant's reach
     entirely: it scans the GameState block, which no longer holds them.
     Scoped to newEconomy's own body rather than to the whole file, so a field
     mentioned anywhere else in state.ts cannot pass for an initialised one. */
  it("defines every economy field in newEconomy", () => {
    const declared = [
      ...blockOf(typesFile(), "export type PlayerEconomy = {").matchAll(/^ {2}(\w+):/gm),
    ].map((m) => m[1]);
    expect(declared.slice().sort()).toEqual(ECONOMY_FIELDS.slice().sort());

    const state = read(join(ROOT, "src/game/state.ts"));
    const from = state.indexOf("export function newEconomy()");
    expect(from).toBeGreaterThan(-1);
    const body = state.slice(from, state.indexOf("export function createRun("));
    const missing = declared.filter((f) => !new RegExp(`\\b${f}\\s*[:,]`).test(body));
    expect(missing).toEqual([]);
  });

  /* A wallet is resolved from a *seat*, never from whoever is looking: under
     lockstep multiplayer a wallet read from the window would be the one value
     that differed between peers. `myEcon` is the name the abandoned per-seat
     branch used for exactly that, and `localSeat`, `seatKind` and the
     usTricks/themTricks pair are the other three things main replaced — a
     blocklist that misses the name someone reaches for guards nothing.

     Every file under src/ is scanned, tests and fixtures included: the names
     the spec forbids are exactly the ones a fixture would reach for first, so
     a helper in test/factories.ts or test/harness.tsx has to fail here too.
     This file is the one exception, because the blocklist has to spell them;
     comments are stripped everywhere else, since the history of the four is
     worth recording. */
  it("ports none of the four names main replaced", () => {
    const banned = ["myEcon", "localSeat", "seatKind", "usTricks", "themTricks"];
    for (const f of ALL.filter((x) => x !== import.meta.filename)) {
      const body = stripComments(read(f));
      for (const name of banned)
        expect(body, `${rel(f)} names ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  /* The opposing team's trick count has been deleted from ScoreContext twice:
     first as `themBefore`, which the seat-absolute change renamed rather than
     dropped, and then as `lostBefore`, which no joker ever read either. A
     scoring-context field nothing consumes is a trap for the next joker
     author, who finds it already computed and assumes it means something the
     engine maintains. It is one expression away — g.tricks[1 - team] — so the
     name is banned rather than merely removed, the same way the five names
     above are.

     Same shape as that case: every file under src/, this one excepted because
     the blocklist has to spell the names, and comments stripped so the history
     stays writable. */
  it("recomputes the other team's tricks rather than carrying them on ScoreContext", () => {
    const banned = ["lostBefore", "themBefore"];
    for (const f of ALL.filter((x) => x !== import.meta.filename)) {
      const body = stripComments(read(f));
      for (const name of banned)
        expect(body, `${rel(f)} names ${name}`).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
});
