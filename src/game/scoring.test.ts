/* Scoring: trick types, the tuppi multiplier table, enhancements, bosses and
   the locked calculation order. */
import { describe, expect, it } from "vitest";
import { chipValue } from "./cards";
import { TYPES } from "./constants";
import { JOKERS } from "./content";
import { evalTrick, scoreTrick, tuppiInfo } from "./scoring";
import { card as C, st } from "../test/factories";
import type { GameState, Joker } from "./types";

const joker = (id: string): Joker => {
  const j = JOKERS.find((x) => x.id === id);
  if (!j) throw new Error("no such joker: " + id);
  return j;
};

describe("trick types", () => {
  const ty = (cs: Parameters<typeof evalTrick>[0]) => evalTrick(cs).id;

  it.each([
    ["flush", [C("H", 2), C("H", 7), C("H", 9), C("H", 13)], "flush"],
    ["mixed trick", [C("H", 2), C("S", 7), C("D", 9), C("C", 12)], "high"],
    ["pair", [C("H", 7), C("S", 7), C("D", 9), C("C", 12)], "pair"],
    ["two pair", [C("H", 7), C("S", 7), C("D", 9), C("C", 9)], "twopair"],
    ["three of a kind", [C("H", 7), C("S", 7), C("D", 7), C("C", 12)], "trips"],
    ["four of a kind", [C("H", 7), C("S", 7), C("D", 7), C("C", 7)], "quad"],
    ["straight", [C("H", 5), C("S", 6), C("D", 7), C("C", 8)], "straight"],
    ["straight flush", [C("H", 5), C("H", 6), C("H", 7), C("H", 8)], "sf"],
    ["three-card trick (sooli)", [C("H", 5), C("H", 6), C("H", 7)], "sf"],
  ])("recognises %s", (_label, cards, want) => {
    expect(ty(cards)).toBe(want);
  });
});

/* In tuppi: rami 7 tricks = 4 points and each further trick +4, so the
   multiplier is tricks-6. Nolo: 6 tricks = 4 points and each trick fewer +4,
   so it is 7-tricks. Ryosto doubles it. A sooli is worth 24 points = 6 x 4. */
describe("tuppi multiplier", () => {
  const mult = (over: Partial<GameState>) => tuppiInfo(st(over)).mult;

  it.each([
    ["rami 6 tricks is short and scores nothing", { mode: "rami", ramTeam: 0, usTricks: 6 }, 0],
    ["rami 7 tricks is x1", { mode: "rami", ramTeam: 0, usTricks: 7 }, 1],
    ["rami 9 tricks is x3", { mode: "rami", ramTeam: 0, usTricks: 9 }, 3],
    ["rami 13 tricks is x7", { mode: "rami", ramTeam: 0, usTricks: 13 }, 7],
    ["ryosto 7 tricks is x2", { mode: "rami", ramTeam: 1, usTricks: 7 }, 2],
    ["ryosto 9 tricks is x6", { mode: "rami", ramTeam: 1, usTricks: 9 }, 6],
    ["nolo 6 tricks is x1", { mode: "nolo", ramTeam: null, usTricks: 6 }, 1],
    ["nolo 3 tricks is x4", { mode: "nolo", ramTeam: null, usTricks: 3 }, 4],
    ["nolo 0 tricks is x7", { mode: "nolo", ramTeam: null, usTricks: 0 }, 7],
    ["nolo 7 tricks collapses", { mode: "nolo", ramTeam: null, usTricks: 7 }, 0],
    ["a clean sooli is x6", { sooli: true, usTricks: 0 }, 6],
    ["a busted sooli is 0", { sooli: true, sooliBust: true, usTricks: 1 }, 0],
  ] as Array<[string, Partial<GameState>, number]>)("%s", (_label, over, want) => {
    expect(mult(over)).toBe(want);
  });

  it("adds the Vanha Tuppi joker and the Tuppisormus voucher", () => {
    expect(mult({ mode: "rami", usTricks: 7, jokers: [joker("vanhatuppi")] })).toBe(2);
    expect(mult({ mode: "rami", usTricks: 7, tuppiBonus: 1 })).toBe(2);
  });

  it("subtracts the Kitsas boss but never below x1", () => {
    expect(mult({ mode: "rami", usTricks: 9, boss: { id: "kitsas", key: "boss.kitsas" } })).toBe(2);
    expect(mult({ mode: "rami", usTricks: 7, boss: { id: "kitsas", key: "boss.kitsas" } })).toBe(1);
  });
});

describe("scoring a trick", () => {
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  const score = (cards: typeof plain, over: Partial<GameState> = {}) =>
    scoreTrick(st(over), 0, 0, cards);
  const base = score(plain);

  it("adds the trick type's chips to the card values", () => {
    expect(base.chips).toBe(TYPES.flush.chips + 5 + 9 + 2 + 7);
    expect(base.mult).toBe(TYPES.flush.mult);
    expect(base.total).toBe(base.chips * base.mult);
  });

  it("applies card enhancements", () => {
    expect(score([C("H", 5, "bonus"), C("H", 9), C("H", 2), C("H", 7)]).chips - base.chips).toBe(
      40,
    );
    expect(score([C("H", 5, "mult"), C("H", 9), C("H", 2), C("H", 7)]).mult - base.mult).toBe(5);
    expect(score([C("H", 5, "glass"), C("H", 9), C("H", 2), C("H", 7)]).chips).toBe(base.chips * 2);
  });

  it("applies steel only while the card is still unplayed", () => {
    const g = st();
    g.hands[0] = [C("D", 3, "steel")];
    expect(scoreTrick(g, 0, 0, plain).mult).toBeCloseTo(base.mult * 1.5);
    expect(score(plain).mult).toBe(base.mult);
  });

  /* scoreTrick is pure: the money comes back in payout and the reducer applies
     it. */
  it("returns the gold payout instead of mutating money", () => {
    const one = score([C("H", 5, "gold"), C("H", 9), C("H", 2), C("H", 7)]);
    expect(one.payout).toBe(3);
    const two = score([C("H", 5, "gold"), C("H", 9, "gold"), C("H", 2), C("H", 7)]);
    expect(two.payout).toBe(6);
    const g = st();
    scoreTrick(g, 0, 0, [C("H", 5, "gold"), C("H", 9), C("H", 2), C("H", 7)]);
    expect(g.money).toBe(st().money);
  });
});

describe("bosses", () => {
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  const punainen = { id: "punainen", key: "boss.punainen" };

  it("zeroes red chips under Punainen kielto", () => {
    expect(chipValue(st({ boss: punainen }), C("H", 9))).toBe(0);
    expect(chipValue(st({ boss: punainen }), C("S", 9))).toBe(9);
  });

  it("removes the trick type's mult under Kasijarru", () => {
    const boss = { id: "kasijarru", key: "boss.kasijarru" };
    expect(scoreTrick(st({ boss }), 0, 0, plain).mult).toBe(1);
  });
});

/* Additions land before multipliers, so purchase order cannot change the
   result. That is a deliberate deviation from Balatro, where the player
   reorders the joker row by hand. */
describe("joker order is locked", () => {
  const withAce = [C("H", 14), C("H", 9), C("H", 2), C("H", 7)];

  it("gives the same mult regardless of purchase order", () => {
    const a = scoreTrick(st({ jokers: [joker("assa"), joker("ramikone")] }), 0, 0, withAce).mult;
    const b = scoreTrick(st({ jokers: [joker("ramikone"), joker("assa")] }), 0, 0, withAce).mult;
    expect(a).toBe(b);
    expect(a).toBe((TYPES.flush.mult + 6) * 2);
  });
});

describe("enhancement jokers", () => {
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  const stoneTrick = [C("S", 2, "stone"), C("H", 9), C("H", 2), C("H", 7)];

  it("gives Kivenveistaja +70 chips per stone card", () => {
    const withJoker = scoreTrick(st({ jokers: [joker("kivenveistaja")] }), 0, 0, stoneTrick).chips;
    expect(withJoker - scoreTrick(st(), 0, 0, stoneTrick).chips).toBe(70);
  });

  it("gives Pakkamestari x0.2 per enhanced side-deck card", () => {
    const g = st({
      jokers: [joker("pakkamestari")],
      sideDeck: [C("S", 2, "stone"), C("H", 3, "gold")],
    });
    expect(scoreTrick(g, 0, 0, plain).mult).toBe(TYPES.flush.mult * 1.4);
  });

  it("reads money through the context, not the state", () => {
    const rich = scoreTrick(st({ jokers: [joker("ahne")], money: 40 }), 0, 0, plain).mult;
    const poor = scoreTrick(st({ jokers: [joker("ahne")], money: 0 }), 0, 0, plain).mult;
    expect(rich).toBeGreaterThan(poor);
  });
});
