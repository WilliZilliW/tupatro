import { teamOf } from "./constants";
import { finalScore } from "./scoring";
import type { GameState, Seat } from "./types";

/* ============================ the race ============================
   Ordinary tuppi, deal after deal, until one partnership's running total
   reaches g.target — at which point the other pair has been put *tuppeen*.
   The structure is tuppi's own: korttipeliopas.fi, "Peli päättyy, kun toinen
   joukkueista pääsee 52 pisteeseen. Silloin vastajoukkue on pantu tuppeen."

   Two readings of the source are deliberate, and both are Tupatro's rather
   than tuppi's:

   1. The *target* is 12,000 of this game's points, not 52 of tuppi's. This
      game's deal score is chips × mult, and its tuppi multiplier already is
      tuppi's point table (7 tricks ×1, 9 ×3, a ryosto doubling it, a sooli
      ×6). The two scales are not convertible, so the number was measured
      instead — see RACE_TARGET in constants.ts.
   2. A *busted sooli scores nothing for anybody*, which contradicts the
      source: korttipeliopas.fi gives the declarers 24 points when the soloist
      takes a trick. Tupatro's tuppiInfo returns a multiplier of 0 on
      sooliBust, and the race keeps that behaviour rather than changing the
      main game's scoring. Correcting it is a scoring spec of its own.

   Nothing here is a second copy of the arithmetic: dealScores is finalScore,
   the main game's formula, asked once per pair. */

/* teamOf(p) is p % 2, so seat 0 is a seat of team 0 and seat 1 of team 1 —
   which makes the team index itself a seat of that team.

   The seat is passed at all because the pure core never resolves a wallet from
   who is looking: finalScore reads the jokers and the tuppisormus voucher out
   of one seat's purse. In a race every wallet is empty, so the choice changes
   no arithmetic today; it is written this way so that a pair is always scored
   against its own side rather than against the run owner's.

   Exported because resolveTrick's race branch scores each trick for both pairs
   and needs the same answer. One definition and one comment: a second copy in
   the reducer is exactly how the two would drift. */
export const seatOfTeam = (t: 0 | 1): Seat => t;

type RaceState = Pick<
  GameState,
  | "tricks"
  | "economies"
  | "boss"
  | "sooli"
  | "sooliBust"
  | "sooliSeat"
  | "mode"
  | "ramTeam"
  | "raceBase"
>;

/* What the deal just played is worth to each pair. Team-indexed, and in an
   ordinary deal exactly one of the two is non-zero: with thirteen tricks one
   side always has seven or more, so in rami exactly one side clears the
   multiplier's floor and in nolo exactly one side is at six or fewer.

   Sooli is the exception, and it takes a branch: scoresFor and tuppiInfo are
   team-blind there — they ask whether the soloist was kept out of every trick,
   not which pair is asking — so calling them for both pairs would credit the
   same number twice and make a successful sooli a no-op in a race decided by
   the difference. Only the soloist's pair banks it. */
export function dealScores(g: RaceState): [number, number] {
  const of = (t: 0 | 1) => finalScore({ ...g, base: g.raceBase[t] }, t, seatOfTeam(t));
  if (g.sooli) {
    if (g.sooliSeat === null) return [0, 0];
    const solo = teamOf(g.sooliSeat);
    const out: [number, number] = [0, 0];
    out[solo] = of(solo);
    return out;
  }
  return [of(0), of(1)];
}

type MatchState = Pick<GameState, "raceScores" | "target">;

export function matchOver(g: MatchState): boolean {
  return Math.max(...g.raceScores) >= g.target;
}

/* The pair at or past the target, or the higher total when both are. Both at
   once cannot happen — one pair scores a deal and the other nothing — but the
   tie-break is written down rather than left to the order of the array. */
export function raceWinner(g: MatchState): 0 | 1 | null {
  const [a, b] = g.raceScores;
  const aIn = a >= g.target;
  const bIn = b >= g.target;
  if (aIn && bIn) return a >= b ? 0 : 1;
  if (aIn) return 0;
  if (bIn) return 1;
  return null;
}
