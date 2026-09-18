import { describe, expect, it } from "vitest";
import { RPS_WINS } from "./constants";
import { beats, RPS_THROWS, rpsOver, rpsWinner } from "./rps";
import type { RpsThrow } from "./types";

describe("beats", () => {
  it("pins the three-way cycle — WRPSA v1.0", () => {
    expect(beats("rock", "scissors")).toBe(true);
    expect(beats("scissors", "paper")).toBe(true);
    expect(beats("paper", "rock")).toBe(true);
  });

  it("pins the three reverse pairings as false", () => {
    expect(beats("scissors", "rock")).toBe(false);
    expect(beats("paper", "scissors")).toBe(false);
    expect(beats("rock", "paper")).toBe(false);
  });

  it("pins every matching pairing as a tie, both ways", () => {
    for (const t of RPS_THROWS) {
      expect(beats(t, t)).toBe(false);
    }
  });

  it("has exactly three throws, each beating exactly one other and losing to exactly one other", () => {
    expect(RPS_THROWS).toHaveLength(3);
    for (const a of RPS_THROWS) {
      const beatenByA = RPS_THROWS.filter((b) => beats(a, b));
      const beatingA = RPS_THROWS.filter((b) => beats(b, a));
      expect(beatenByA).toHaveLength(1);
      expect(beatingA).toHaveLength(1);
      /* No throw beats and loses to the same other throw — the table cannot
         be edited into a dominant throw. */
      expect(beatenByA[0]).not.toBe(beatingA[0]);
    }
  });
});

describe("rpsOver / rpsWinner", () => {
  /* Every reachable wins pair from [0,0] to [2,1] — a match ends the moment
     either side reaches RPS_WINS, so [2,2] can never occur. */
  const cases: Array<{ wins: [number, number]; over: boolean; winner: 0 | 1 | null }> = [
    { wins: [0, 0], over: false, winner: null },
    { wins: [1, 0], over: false, winner: null },
    { wins: [0, 1], over: false, winner: null },
    { wins: [1, 1], over: false, winner: null },
    { wins: [2, 0], over: true, winner: 0 },
    { wins: [0, 2], over: true, winner: 1 },
    { wins: [2, 1], over: true, winner: 0 },
    { wins: [1, 2], over: true, winner: 1 },
  ];

  it.each(cases)("wins %j", ({ wins, over, winner }) => {
    expect(RPS_WINS).toBe(2);
    expect(rpsOver(wins)).toBe(over);
    expect(rpsWinner(wins)).toBe(winner);
  });
});

/* Every throw value used above is a real RpsThrow, so the pairing tests above
   cannot silently pass on a typo'd string. */
it("RPS_THROWS carries exactly rock, paper and scissors", () => {
  const set = new Set<RpsThrow>(RPS_THROWS);
  expect(set).toEqual(new Set<RpsThrow>(["rock", "paper", "scissors"]));
});
