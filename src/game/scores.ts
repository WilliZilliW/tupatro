import { raceWinner } from "./race";
import { ownerTeam } from "./rules";
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

/* ==================== the challenge board ====================
   A second board, not a second view of the first: a challenge has no ante and
   no blind, its score is a laydown total in the low hundreds, and comparing it
   with a main-game run would be nonsense. Its own row shape, its own version
   and — in storage.ts — its own key per challenge. */

export const CHALLENGE_SCORES_VERSION = 1;

export type ChallengeRow = { seed: string; score: number; at: number };

export function challengeRowFor(g: GameState, at: number): ChallengeRow {
  return { seed: g.seed, score: g.runScore, at };
}

/* Highest score first, and a tie to whoever got there first. A challenge score
   may be negative, so nothing here assumes a floor. */
function compareChallenge(a: ChallengeRow, b: ChallengeRow): number {
  return b.score - a.score || a.at - b.at;
}

/* Everything but the timestamp, exactly as `sameRun` above: StrictMode's
   double effect files the same row twice and the board must not grow. */
function sameChallengeRun(a: ChallengeRow, b: ChallengeRow): boolean {
  return a.seed === b.seed && a.score === b.score;
}

export function addChallengeScore(rows: ChallengeRow[], row: ChallengeRow): ChallengeRow[] {
  const merged = rows.some((r) => sameChallengeRun(r, row)) ? rows.slice() : [...rows, row];
  return merged.sort(compareChallenge).slice(0, SCORES_MAX);
}

function isChallengeRow(v: unknown): v is ChallengeRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.seed === "string" && typeof r.score === "number" && typeof r.at === "number";
}

export function parseChallengeScores(raw: unknown): ChallengeRow[] {
  if (typeof raw !== "object" || raw === null) return [];
  const payload = raw as { v?: unknown; rows?: unknown };
  if (payload.v !== CHALLENGE_SCORES_VERSION) return [];
  const rows = payload.rows;
  if (!Array.isArray(rows)) return [];
  if (!rows.every(isChallengeRow)) return [];
  return rows.reduce<ChallengeRow[]>((acc, r) => addChallengeScore(acc, r), []);
}

/* ==================== the race board ====================
   A third board, and a third row shape: a race has no ante and no blind like
   the challenge, but unlike the challenge it can be lost, and its interesting
   number is how *few* deals it took. Its own version and — in storage.ts — a
   key of its own that is deliberately not `tupatro-challenge-race-v1`, since
   that is the shape parseChallengeScores reads and two parsers sharing one key
   is how a board gets silently dropped.

   Like the main board and unlike a challenge's, a lost match files a row too:
   the mode has an opponent, so losing is a result. */

export const RACE_SCORES_VERSION = 1;

export type RaceRow = { seed: string; won: boolean; deals: number; score: number; at: number };

/* The run owner's pair's, which in a hot-seat match is one row for the seat
   the shell belongs to rather than one per player. A per-seat board is a
   feature of its own. */
export function raceRowFor(g: GameState, at: number): RaceRow {
  const team = ownerTeam(g);
  return {
    seed: g.seed,
    won: raceWinner(g) === team,
    deals: g.raceDeal,
    score: g.raceScores[team],
    at,
  };
}

/* Won matches first, then the *fewest* deals — a race won in four beats one
   won in twelve — then the higher score, then the earlier timestamp. */
function compareRace(a: RaceRow, b: RaceRow): number {
  return Number(b.won) - Number(a.won) || a.deals - b.deals || b.score - a.score || a.at - b.at;
}

function sameRaceRun(a: RaceRow, b: RaceRow): boolean {
  return a.seed === b.seed && a.won === b.won && a.deals === b.deals && a.score === b.score;
}

export function addRaceScore(rows: RaceRow[], row: RaceRow): RaceRow[] {
  const merged = rows.some((r) => sameRaceRun(r, row)) ? rows.slice() : [...rows, row];
  return merged.sort(compareRace).slice(0, SCORES_MAX);
}

function isRaceRow(v: unknown): v is RaceRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.seed === "string" &&
    typeof r.won === "boolean" &&
    typeof r.deals === "number" &&
    typeof r.score === "number" &&
    typeof r.at === "number"
  );
}

export function parseRaceScores(raw: unknown): RaceRow[] {
  if (typeof raw !== "object" || raw === null) return [];
  const payload = raw as { v?: unknown; rows?: unknown };
  if (payload.v !== RACE_SCORES_VERSION) return [];
  const rows = payload.rows;
  if (!Array.isArray(rows)) return [];
  if (!rows.every(isRaceRow)) return [];
  return rows.reduce<RaceRow[]>((acc, r) => addRaceScore(acc, r), []);
}
