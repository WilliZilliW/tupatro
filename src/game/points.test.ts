/* Tuppi's own point table, pinned against the source's numbers, and the
   4 x tuppiMult identity that keeps this scale and the main game's from
   drifting apart. */
import { describe, expect, it } from "vitest";
import { dealPoints } from "./points";
import { seatOfTeam } from "./race";
import { tuppiMult } from "./scoring";
import { st, type StateOver } from "../test/factories";
import type { GameState } from "./types";

/* A deal already played. Every wallet is empty and there is no boss, which is
   what a match is played with: tuppiMult's joker bonus and kitsas penalty are
   both zero, so the identity below is about the table and nothing else. */
const dealt = (over: StateOver): GameState => st({ sooli: false, sooliBust: false, ...over });

/* Thirteen tricks, so one pair's count fixes the other's. */
const split = (won: number): [number, number] => [won, 13 - won];

describe("rami: four points a trick from the seventh", () => {
  /* "Ramissa voittoon tarvitaan seitseman kasaa. Seitsemasta kasasta saa
     nelja pistetta, sen jalkeen jokainen ylimaarainen kasa on neljan pisteen
     arvoinen." Seven tricks is four points, not four *per* trick from zero. */
  it.each([
    [7, 4],
    [8, 8],
    [9, 12],
    [10, 16],
    [11, 20],
    [12, 24],
    [13, 28],
  ])("gives the declaring pair %i tricks -> %i points", (won, points) => {
    const g = dealt({ mode: "rami", ramTeam: 0, tricks: split(won) });
    expect(dealPoints(g)[0]).toBe(points);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("gives a declaring pair short at %i tricks nothing", (won) => {
    const g = dealt({ mode: "rami", ramTeam: 0, tricks: split(won) });
    expect(dealPoints(g)[0]).toBe(0);
  });

  it("scores exactly one pair on every rami trick count", () => {
    for (let won = 0; won <= 13; won++) {
      const p = dealPoints(dealt({ mode: "rami", ramTeam: 0, tricks: split(won) }));
      expect(p.filter((x) => x > 0)).toHaveLength(1);
    }
  });
});

describe("ryosto: a robbed rami is worth double", () => {
  /* "Ryostetty rami on arvoltaan kaksinkertainen, eli jokainen kasa
     seitsemannesta alkaen on kahdeksan pisteen arvoinen." The declaring pair
     is team 1 here, so team 0's seven-plus is a robbery. */
  it.each([
    [7, 8],
    [8, 16],
    [9, 24],
    [10, 32],
    [11, 40],
    [12, 48],
    [13, 56],
  ])("gives the defending pair %i tricks -> %i points", (won, points) => {
    const g = dealt({ mode: "rami", ramTeam: 1, tricks: split(won) });
    expect(dealPoints(g)).toEqual([points, 0]);
  });

  /* A forced-rami deal has no declarer, and "nobody declared it" is not a
     robbery: the null ramTeam must score single, not double. */
  it("does not double a rami nobody declared", () => {
    const g = dealt({ mode: "rami", ramTeam: null, tricks: split(9) });
    expect(dealPoints(g)).toEqual([12, 0]);
  });
});

describe("nolo: four points at six tricks and four more for each fewer", () => {
  /* "Kuudella kasalla joukkue saa nelja pistetta ja jokainen kasa vahemman
     lisaa pisteita neljalla." */
  it.each([
    [6, 4],
    [5, 8],
    [4, 12],
    [3, 16],
    [2, 20],
    [1, 24],
    [0, 28],
  ])("gives the dodging pair %i tricks -> %i points", (won, points) => {
    const g = dealt({ mode: "nolo", ramTeam: null, tricks: split(won) });
    expect(dealPoints(g)[0]).toBe(points);
  });

  it.each([7, 8, 9, 10, 11, 12, 13])("gives a pair that busted at %i tricks nothing", (won) => {
    const g = dealt({ mode: "nolo", ramTeam: null, tricks: split(won) });
    expect(dealPoints(g)[0]).toBe(0);
  });

  it("scores exactly one pair on every nolo trick count", () => {
    for (let won = 0; won <= 13; won++) {
      const p = dealPoints(dealt({ mode: "nolo", ramTeam: null, tricks: split(won) }));
      expect(p.filter((x) => x > 0)).toHaveLength(1);
    }
  });
});

describe("sooli: 24 either way, and to opposite pairs", () => {
  /* "Jos soolaaja selviaa tikeitta, pari saa 24 pistetta. Jos soolaaja ottaa
     yhdenkin tikin, ramaajat saavat 24 pistetta."

     The soloist sits at seat 1 and the rami was declared by team 0, so the
     two outcomes name two different pairs. A fixture where ramTeam and the
     soloist's team coincide would prove nothing about which one is read. */
  const soolied = (over: StateOver): GameState =>
    st({ sooli: true, mode: "rami", ramTeam: 0, sooliSeat: 1, ...over });

  it("pays the soloist's pair 24 when the sooli holds", () => {
    const g = soolied({ sooliBust: false, tricks: [13, 0] });
    expect(dealPoints(g)).toEqual([0, 24]);
  });

  /* The one place this mode and the other two disagree: tuppiInfo returns a
     multiplier of 0 on a bust, so the main game and the race score it for
     nobody. The source gives the declarers 24 and so does this table. */
  it("pays the declaring pair 24 when the sooli busts, where the race pays nobody", () => {
    const g = soolied({ sooliBust: true, tricks: [12, 1] });
    expect(dealPoints(g)).toEqual([24, 0]);
    expect(tuppiMult(g, 0, seatOfTeam(0))).toBe(0);
    expect(tuppiMult(g, 1, seatOfTeam(1))).toBe(0);
  });

  /* "ramaajat" is the pair that declared the rami. Should ramTeam ever be
     null the fallback is the non-soloist's pair rather than nobody. */
  it("falls back to the non-soloist's pair when nobody declared", () => {
    const g = soolied({ sooliBust: true, ramTeam: null, tricks: [12, 1] });
    expect(dealPoints(g)).toEqual([24, 0]);
  });

  it("scores nobody when there is no soloist at all", () => {
    const g = soolied({ sooliBust: false, sooliSeat: null, tricks: [13, 0] });
    expect(dealPoints(g)).toEqual([0, 0]);
  });
});

/* The whole reason the race could not use this table: away from sooli it is
   exactly four times the multiplier the main game already carries. Sooli is
   excluded because the two genuinely disagree there — tuppiInfo returns 6 on
   a held sooli, which times four would be 24 for the soloist's pair but also
   24 for a pair that is not asking, and 0 on a bust where this table pays the
   declarers 24. */
describe("away from sooli the table is four times the tuppi multiplier", () => {
  const cases: Array<[string, StateOver]> = [];
  for (let won = 0; won <= 13; won++) {
    cases.push([`rami ${won}-${13 - won}`, { mode: "rami", ramTeam: 0, tricks: split(won) }]);
    cases.push([`ryosto ${won}-${13 - won}`, { mode: "rami", ramTeam: 1, tricks: split(won) }]);
    cases.push([`nolo ${won}-${13 - won}`, { mode: "nolo", ramTeam: null, tricks: split(won) }]);
  }

  it.each(cases)("%s", (_name, over) => {
    const g = dealt(over);
    const points = dealPoints(g);
    for (const team of [0, 1] as const) {
      expect(points[team]).toBe(4 * tuppiMult(g, team, seatOfTeam(team)));
    }
  });
});
