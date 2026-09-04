/* The only place on the game side that touches localStorage. Everything
   throws in a private window, so every call is guarded. */

import { SCORES_VERSION, parseScores, type ScoreRow } from "./scores";
import type { SavedRun } from "./save";

const BEST_KEY = "tupatro-best";

export function readBestAnte(): number {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function writeBestAnte(a: number): void {
  try {
    if (a > readBestAnte()) localStorage.setItem(BEST_KEY, String(a));
  } catch {
    /* no storage: the best ante stays known to this session only */
  }
}

/* ============================ the run ============================
   The snapshot itself is built by save.ts; this side only moves the bytes.
   A save that will not parse is treated as no save at all. */

const RUN_KEY = "tupatro-run-v1";

export function readRun(): unknown | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeRun(s: SavedRun): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(s));
  } catch {
    /* no storage or no quota: the run lives in this session only */
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    /* nothing to clear if there was nothing to write */
  }
}

/* ============================ the scoreboard ============================
   A second key on purpose: clearRun() above removes the run and nothing else,
   so game over wipes the snapshot and leaves the board standing. */

const SCORES_KEY = "tupatro-scores-v1";

export function readScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    return raw ? parseScores(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeScores(rows: ScoreRow[]): void {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify({ v: SCORES_VERSION, rows }));
  } catch {
    /* no storage or no quota: the board lives in this session only */
  }
}
