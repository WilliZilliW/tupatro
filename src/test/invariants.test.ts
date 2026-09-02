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
  "src/game/rules.ts",
  "src/game/scoring.ts",
  "src/game/ai.ts",
  "src/game/shop.ts",
  "src/game/schedule.ts",
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

describe("state", () => {
  it("has no module-level mutable state outside the store", () => {
    /* Everything mutable lives in the game state. A module-level `let` would
       be state the reducer cannot see and StrictMode does not tolerate. */
    for (const f of APP) {
      const body = stripComments(read(f));
      expect(body, `${rel(f)} declares module-level let`).not.toMatch(/^let\s/m);
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
});
