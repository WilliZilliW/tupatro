import type { GameState } from "./types";

/* ============================ the scoreboard ============================
   A finished run leaves one row behind. This module owns the row's shape, the
   order and the truncation; storage.ts moves the bytes and the React layer
   decides when a run is over.

   Pure like the rest of the core: the timestamp is passed in rather than read
   from Date.now(), so a board can be built and asserted without a clock. */

/* Bumped when the row shape changes. An old board is then rejected and
   overwritten in place — boards are not migrated. */
export const SCORES_VERSION = 1;

export const SCORES_MAX = 10;

export type ScoreRow = {
  seed: string;
  ante: number;
  blindIdx: number;
  runScore: number;
  won: boolean;
  at: number;
};

export function rowFor(g: GameState, won: boolean, at: number): ScoreRow {
  return { seed: g.seed, ante: g.ante, blindIdx: g.blindIdx, runScore: g.runScore, won, at };
}

/* Best first: a won run beats a lost one, then the higher ante, then the
   higher score. A tie is broken by the earlier timestamp, so whoever got there
   first keeps the slot. */
function compare(a: ScoreRow, b: ScoreRow): number {
  return Number(b.won) - Number(a.won) || b.ante - a.ante || b.runScore - a.runScore || a.at - b.at;
}

/* Everything but the timestamp. Two rows that agree on all of it are the same
   result, which is what makes addScore idempotent: StrictMode's double effect
   and any re-render file the row again and the board does not grow. The cost
   is that replaying a seed to an identical result files one row, not two. */
function sameRun(a: ScoreRow, b: ScoreRow): boolean {
  return (
    a.seed === b.seed &&
    a.ante === b.ante &&
    a.blindIdx === b.blindIdx &&
    a.runScore === b.runScore &&
    a.won === b.won
  );
}

export function addScore(rows: ScoreRow[], row: ScoreRow): ScoreRow[] {
  /* The row already on the board wins, timestamp and all: a re-render must not
     shuffle a row's tie-break out from under it. */
  const merged = rows.some((r) => sameRun(r, row)) ? rows.slice() : [...rows, row];
  return merged.sort(compare).slice(0, SCORES_MAX);
}

function isRow(v: unknown): v is ScoreRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.seed === "string" &&
    typeof r.ante === "number" &&
    typeof r.blindIdx === "number" &&
    typeof r.runScore === "number" &&
    typeof r.won === "boolean" &&
    typeof r.at === "number"
  );
}

/* Anything that is not exactly a board of this version is no board at all: a
   half-read payload would put nonsense on the end screen, and the board is
   cheap to lose. */
export function parseScores(raw: unknown): ScoreRow[] {
  if (typeof raw !== "object" || raw === null) return [];
  const payload = raw as { v?: unknown; rows?: unknown };
  if (payload.v !== SCORES_VERSION) return [];
  const rows = payload.rows;
  if (!Array.isArray(rows)) return [];
  if (!rows.every(isRow)) return [];
  /* Rebuilt through addScore rather than trusted: a hand-edited store cannot
     put a row in an order the game never sorts into. */
  return rows.reduce<ScoreRow[]>((acc, r) => addScore(acc, r), []);
}
