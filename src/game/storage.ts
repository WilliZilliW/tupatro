/* The only place on the game side that touches localStorage. Everything
   throws in a private window, so every call is guarded. */

import {
  CHALLENGE_SCORES_VERSION,
  RACE_SCORES_VERSION,
  RPS_SCORES_VERSION,
  SCORES_VERSION,
  parseChallengeScores,
  parseRaceScores,
  parseRpsScores,
  parseScores,
  type ChallengeRow,
  type RaceRow,
  type RpsRow,
  type ScoreRow,
} from "./scores";
import type { SavedRun } from "./save";
import type { ChallengeId, MatchId } from "./types";

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

/* ============================ a challenge's own run ============================
   One slot per mode, on the same shape save.ts already builds for the main
   run — deliberately `tupatro-run-<id>-v1` and not challengeKey(id): that
   shape is the board's, built and parsed below by readChallengeScores, and a
   save read through a board's parser (or the reverse) is how a slot gets
   silently dropped. Guarded exactly like readRun/writeRun/clearRun above; a
   save that will not parse is no save at all. */

export function challengeRunKey(id: ChallengeId): string {
  return `tupatro-run-${id}-v1`;
}

export function readChallengeRun(id: ChallengeId): unknown | null {
  try {
    const raw = localStorage.getItem(challengeRunKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeChallengeRun(id: ChallengeId, s: SavedRun): void {
  try {
    localStorage.setItem(challengeRunKey(id), JSON.stringify(s));
  } catch {
    /* no storage or no quota: this slot lives in this session only */
  }
}

export function clearChallengeRun(id: ChallengeId): void {
  try {
    localStorage.removeItem(challengeRunKey(id));
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

/* ============================ the challenge boards ============================
   One key per challenge, so a second challenge cannot dilute the first one's
   top ten and neither can touch the main board. No removeItem of its own:
   clearRun stays the only place a key is removed. */

const challengeKey = (id: ChallengeId): string => `tupatro-challenge-${id}-v1`;

export function readChallengeScores(id: ChallengeId): ChallengeRow[] {
  try {
    const raw = localStorage.getItem(challengeKey(id));
    return raw ? parseChallengeScores(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeChallengeScores(id: ChallengeId, rows: ChallengeRow[]): void {
  try {
    localStorage.setItem(challengeKey(id), JSON.stringify({ v: CHALLENGE_SCORES_VERSION, rows }));
  } catch {
    /* no storage or no quota: the board lives in this session only */
  }
}

/* ============================ the match boards ============================
   The fourth key onwards, one per match mode, and deliberately not
   challengeKey(id) for any of them: that shape belongs to
   parseChallengeScores, and two parsers reading one key is how a board gets
   silently dropped.

   One key per mode, for the same reason again a level up. A RaceRow fits
   every match mode, so a 52-point traditional or Tupatro match — or a Nami
   match on its own ±40 scale — filed on the race's board would be outranked
   by every chip-scale row there and outrank nothing: a board that silently
   became a different board. The scales are not comparable, so they do not
   share a key, and the mode is a parameter rather than a default so a new
   call site cannot quietly file on the wrong one. Tupatro's own key is named
   after the mode, not the shell it adds, the same way "tuppi"'s is, and each
   Nami variant files on its own because the two tables are two scales.

   No removeItem here either — clearRun stays the only place a key is
   removed. */

const MATCH_KEY: Record<MatchId, string> = {
  race: "tupatro-race-v1",
  tuppi: "tupatro-tuppi-v1",
  tupatro: "tupatro-tupatro-v1",
  nami: "tupatro-nami-v1",
  namihard: "tupatro-namihard-v1",
  politiikka: "tupatro-politiikka-v1",
};

export function readRaceScores(mode: MatchId): RaceRow[] {
  try {
    const raw = localStorage.getItem(MATCH_KEY[mode]);
    return raw ? parseRaceScores(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeRaceScores(mode: MatchId, rows: RaceRow[]): void {
  try {
    localStorage.setItem(MATCH_KEY[mode], JSON.stringify({ v: RACE_SCORES_VERSION, rows }));
  } catch {
    /* no storage or no quota: the board lives in this session only */
  }
}

/* ============================ the Rock-Paper-Scissors board ============================
   A sixth key: not a MatchId, so it does not belong in MATCH_KEY, and not a
   ChallengeRow either — a best-of-three has no score, only a result and a
   round count. No removeItem here, for the same reason none of the boards
   above have one: clearRun stays the only place a key is removed, and this
   mode never writes a run snapshot to clear in the first place. */

const RPS_KEY = "tupatro-rps-v1";

export function readRpsScores(): RpsRow[] {
  try {
    const raw = localStorage.getItem(RPS_KEY);
    return raw ? parseRpsScores(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function writeRpsScores(rows: RpsRow[]): void {
  try {
    localStorage.setItem(RPS_KEY, JSON.stringify({ v: RPS_SCORES_VERSION, rows }));
  } catch {
    /* no storage or no quota: the board lives in this session only */
  }
}
