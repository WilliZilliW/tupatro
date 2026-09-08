/* The race: per-pair deal scoring, the win test, and that a seeded match
   always terminates with exactly one pair across the line. */
import { describe, expect, it } from "vitest";
import { RACE_TARGET } from "./constants";
import { econOf } from "./economy";
import { dealScores, matchOver, raceWinner } from "./race";
import { basicPolicy, playRace } from "../test/bot";
import { st, withEcon, type StateOver } from "../test/factories";
import type { GameState, Seat } from "./types";

/* A deal already played: raceBase is what resolveTrick accumulated for each
   pair, and dealScores is what endHand banks from it. */
const dealt = (over: StateOver): GameState => st({ sooli: false, sooliBust: false, ...over });

describe("a deal scores for one pair and the other gets nothing", () => {
  it("gives a rami 7-6 to the seven side and zero to the other", () => {
    const g = dealt({ mode: "rami", ramTeam: 0, tricks: [7, 6], raceBase: [1000, 500] });
    expect(dealScores(g)).toEqual([1000, 0]);
  });

  it("multiplies a rami 9-4 by three", () => {
    const g = dealt({ mode: "rami", ramTeam: 0, tricks: [9, 4], raceBase: [1000, 500] });
    expect(dealScores(g)).toEqual([3000, 0]);
  });

  /* A ryosto is a rami the *other* pair declared: ramTeam is the side that
     fell short of seven, and the pair that took the tricks counts double. */
  it("doubles the defending pair in a ryosto and leaves the declarers at zero", () => {
    const g = dealt({ mode: "rami", ramTeam: 1, tricks: [9, 4], raceBase: [1000, 500] });
    expect(dealScores(g)).toEqual([6000, 0]);
  });

  it("gives a nolo 6-7 to the six side", () => {
    const g = dealt({ mode: "nolo", ramTeam: null, tricks: [6, 7], raceBase: [800, 400] });
    expect(dealScores(g)).toEqual([800, 0]);
  });

  /* The same pair test from the other direction: the six side is team 1 now,
     so a dealScores that always answered about team 0 would fail here. */
  it("gives a nolo 7-6 to the six side", () => {
    const g = dealt({ mode: "nolo", ramTeam: null, tricks: [7, 6], raceBase: [800, 400] });
    expect(dealScores(g)).toEqual([0, 400]);
  });

  it("counts a nolo down from six", () => {
    const g = dealt({ mode: "nolo", ramTeam: null, tricks: [3, 10], raceBase: [800, 400] });
    expect(dealScores(g)).toEqual([3200, 0]);
  });
});

describe("sooli in a race", () => {
  /* scoresFor and tuppiInfo are team-blind in sooli — they ask whether the
     soloist was kept out of every trick — so raceBase accumulates the same
     number for both pairs. Only the soloist's pair may bank it, or a sooli
     would be a no-op in a race decided by the difference. */
  it("gives a successful sooli to the soloist's pair alone, at six times", () => {
    const g = dealt({
      sooli: true,
      sooliSeat: 1,
      tricks: [13, 0],
      raceBase: [900, 900],
    });
    expect(dealScores(g)).toEqual([0, 5400]);
  });

  it("gives the same sooli to team 0 when the soloist sits there", () => {
    const g = dealt({ sooli: true, sooliSeat: 2, tricks: [0, 13], raceBase: [900, 900] });
    expect(dealScores(g)).toEqual([5400, 0]);
  });

  /* Tupatro's tuppiInfo returns a multiplier of 0 on sooliBust, so the deal
     scores for nobody. korttipeliopas.fi gives the declarers 24 points
     instead; the race keeps this game's behaviour knowingly rather than
     changing the main game's scoring, and race.ts records why. */
  it("gives a busted sooli to nobody", () => {
    const g = dealt({
      sooli: true,
      sooliBust: true,
      sooliSeat: 1,
      tricks: [12, 1],
      raceBase: [900, 900],
    });
    expect(dealScores(g)).toEqual([0, 0]);
  });

  it("scores nothing at all when no seat took the sooli", () => {
    const g = dealt({ sooli: true, sooliSeat: null, raceBase: [900, 900] });
    expect(dealScores(g)).toEqual([0, 0]);
  });
});

/* Every wallet is empty in the mode's ordinary operation, so a call given the
   wrong seat's purse produces the right number by accident. This is the one
   test that makes the seat visible: team 1's wallet carries a tuppisormus-sized
   bonus and team 0's does not, so scoring team 1 against seat 0 — or against
   the trick winner, or against the run owner — comes out at 3,000 instead of
   5,000. Reading g.raceBase[0] for both teams gives 0 here. */
describe("each pair is scored against its own seat's wallet", () => {
  it("reads team 1's own tuppiBonus, not the run owner's", () => {
    const base = dealt({ mode: "rami", ramTeam: 1, tricks: [4, 9], raceBase: [0, 1000] });
    const g = withEcon(base, 1, { tuppiBonus: 2 });
    expect(dealScores(g)).toEqual([0, 5000]);
    /* Without the bonus the same deal is 3,000: the difference is the wallet. */
    expect(dealScores(base)).toEqual([0, 3000]);
  });
});

describe("the win test", () => {
  const at = (scores: [number, number]): GameState =>
    st({ raceScores: scores, target: RACE_TARGET });

  it.each([
    [RACE_TARGET - 1, 0, false, null],
    [RACE_TARGET, 0, true, 0],
    [RACE_TARGET + 1, 0, true, 0],
    [0, RACE_TARGET - 1, false, null],
    [0, RACE_TARGET, true, 1],
    [500, RACE_TARGET + 4000, true, 1],
  ])("reads %d / %d as over=%s, winner=%s", (a, b, over, winner) => {
    const g = at([a, b]);
    expect(matchOver(g)).toBe(over);
    expect(raceWinner(g)).toBe(winner);
  });

  /* Both pairs across cannot happen — one pair scores a deal and the other
     nothing — but the tie-break is written down rather than left to the array
     order. */
  it("gives the higher total when both pairs are past the target", () => {
    expect(raceWinner(at([13000, 12500]))).toBe(0);
    expect(raceWinner(at([12500, 13000]))).toBe(1);
  });
});

/* ==================== whole matches, headless ====================
   The termination argument, played rather than argued: drive.ts's step loop
   and the game's own chooseAI, with the bot acting for whichever seat
   waitingSeat names. */
describe("every seeded match terminates", () => {
  const SEEDS = Array.from({ length: 60 }, (_, i) => `RACE${i}`);

  it.each(SEEDS)("finishes %s with exactly one pair across the line", (seed) => {
    const { state, deals, winner, dealCount } = playRace(seed);
    const [a, b] = state.raceScores;

    expect(raceWinner(state)).not.toBeNull();
    expect(state.raceScores[winner]).toBeGreaterThanOrEqual(RACE_TARGET);
    /* The loser is short of it: a match that ended with both pairs across
       would mean a deal had scored for both. */
    expect(state.raceScores[1 - winner]).toBeLessThan(RACE_TARGET);
    expect(winner).toBe(a >= b ? 0 : 1);
    expect(dealCount).toBe(deals.length);
    expect(dealCount).toBeGreaterThan(0);

    /* basicPolicy never takes a sooli, so every deal here is a rami or a nolo
       and exactly one pair scores it. */
    for (const [x, y] of deals)
      expect([x > 0, y > 0]).toEqual(x > 0 ? [true, false] : [false, true]);
    /* And the banked totals are the deals added up. */
    expect(a).toBe(deals.reduce((s, d) => s + d[0], 0));
    expect(b).toBe(deals.reduce((s, d) => s + d[1], 0));

    /* No money moved in any of it: ctx.payout is discarded and there is no
       shop, no cash-out and no blind reward to credit a purse from. */
    for (const p of [0, 1, 2, 3] as Seat[]) expect(econOf(state, p).money).toBe(0);
    /* And nothing the roguelike shell counts moved either — a whole match
       leaves them exactly where startChallenge put them. */
    expect([state.deals, state.blindDeals, state.dealsLeft]).toEqual([0, 0, 0]);
    expect([state.ante, state.blindIdx]).toEqual([1, 0]);
    expect(state.beaten).toEqual([false, false, false, false]);
    expect(state.blindScore).toBe(0);
    expect(state.boss).toBeNull();
  });

  /* A busted sooli is the one deal that can score nothing for either pair, so
     a policy that takes every sooli offered is the case where a match could
     fail to advance. Measured at a median of 11 deals and a maximum of 27, so
     the 60-deal ceiling inside playRace holds. */
  it.each(Array.from({ length: 20 }, (_, i) => `SOOLI${i}`))(
    "finishes %s even when every sooli is accepted",
    (seed) => {
      const { state, deals, winner } = playRace(seed, { ...basicPolicy, playSooli: () => true });
      expect(state.raceScores[winner]).toBeGreaterThanOrEqual(RACE_TARGET);
      expect(state.raceScores[1 - winner]).toBeLessThan(RACE_TARGET);
      /* Never both: a deal scores for one pair or, if a sooli broke, neither. */
      for (const [x, y] of deals) expect(x > 0 && y > 0).toBe(false);
    },
  );

  /* Four humans is what proves the mode assumes no seat: every phase is gated
     on a person, and a loop or a guard that reached for seat 0 would stall. */
  it.each(Array.from({ length: 10 }, (_, i) => `HOT${i}`))(
    "finishes %s with all four seats human",
    (seed) => {
      const { state, winner, dealCount } = playRace(seed, basicPolicy, 4);
      expect(state.seats).toEqual(["human", "human", "human", "human"]);
      expect(state.raceScores[winner]).toBeGreaterThanOrEqual(RACE_TARGET);
      expect(state.raceScores[1 - winner]).toBeLessThan(RACE_TARGET);
      expect(dealCount).toBeGreaterThan(0);
    },
  );
});
