/* Scoring: trick types, the tuppi multiplier table, enhancements, bosses and
   the locked calculation order. */
import { econOf } from "./economy";
import { describe, expect, it } from "vitest";
import { chipValue } from "./cards";
import { TYPES, teamOf } from "./constants";
import { JOKERS } from "./content";
import { evalTrick, finalScore, scoreTrick, tuppiInfo } from "./scoring";
import { card as C, st, withEcon, type StateOver } from "../test/factories";
import type { GameState, Joker, Seat } from "./types";

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
  const mult = (over: StateOver, team: 0 | 1 = 0) => tuppiInfo(st(over), team, 0).mult;

  it.each([
    ["rami 6 tricks is short and scores nothing", { mode: "rami", ramTeam: 0, tricks: [6, 7] }, 0],
    ["rami 7 tricks is x1", { mode: "rami", ramTeam: 0, tricks: [7, 6] }, 1],
    ["rami 9 tricks is x3", { mode: "rami", ramTeam: 0, tricks: [9, 4] }, 3],
    ["rami 13 tricks is x7", { mode: "rami", ramTeam: 0, tricks: [13, 0] }, 7],
    ["ryosto 7 tricks is x2", { mode: "rami", ramTeam: 1, tricks: [7, 6] }, 2],
    ["ryosto 9 tricks is x6", { mode: "rami", ramTeam: 1, tricks: [9, 4] }, 6],
    ["nolo 6 tricks is x1", { mode: "nolo", ramTeam: null, tricks: [6, 7] }, 1],
    ["nolo 3 tricks is x4", { mode: "nolo", ramTeam: null, tricks: [3, 10] }, 4],
    ["nolo 0 tricks is x7", { mode: "nolo", ramTeam: null, tricks: [0, 13] }, 7],
    ["nolo 7 tricks collapses", { mode: "nolo", ramTeam: null, tricks: [7, 6] }, 0],
    ["a clean sooli is x6", { sooli: true, tricks: [0, 13] }, 6],
    ["a busted sooli is 0", { sooli: true, sooliBust: true, tricks: [1, 12] }, 0],
  ] as Array<[string, StateOver, number]>)("%s", (_label, over, want) => {
    expect(mult(over)).toBe(want);
  });

  it("adds the Vanha Tuppi joker and the Tuppisormus voucher", () => {
    expect(mult({ mode: "rami", tricks: [7, 6], jokers: [joker("vanhatuppi")] })).toBe(2);
    expect(mult({ mode: "rami", tricks: [7, 6], tuppiBonus: 1 })).toBe(2);
  });

  it("subtracts the Kitsas boss but never below x1", () => {
    expect(mult({ mode: "rami", tricks: [9, 4], boss: { id: "kitsas", key: "boss.kitsas" } })).toBe(
      2,
    );
    expect(mult({ mode: "rami", tricks: [7, 6], boss: { id: "kitsas", key: "boss.kitsas" } })).toBe(
      1,
    );
  });

  /* The multiplier table belongs to no side. Asked about team 1 with the
     trick pair mirrored, every row of the table above gives the same answer,
     and a ryosto is now the rami team 0 declared. */
  it("gives team 1 the same table, on its own half of the trick pair", () => {
    expect(mult({ mode: "rami", ramTeam: 1, tricks: [6, 7] }, 1)).toBe(1);
    expect(mult({ mode: "rami", ramTeam: 1, tricks: [4, 9] }, 1)).toBe(3);
    expect(mult({ mode: "rami", ramTeam: 1, tricks: [0, 13] }, 1)).toBe(7);
    expect(mult({ mode: "rami", ramTeam: 1, tricks: [7, 6] }, 1)).toBe(0);
    /* the ryosto doubling follows the team asked about, not the literal 1 */
    expect(mult({ mode: "rami", ramTeam: 0, tricks: [6, 7] }, 1)).toBe(2);
    expect(mult({ mode: "rami", ramTeam: 0, tricks: [4, 9] }, 1)).toBe(6);
    expect(mult({ mode: "nolo", ramTeam: null, tricks: [7, 6] }, 1)).toBe(1);
    expect(mult({ mode: "nolo", ramTeam: null, tricks: [13, 0] }, 1)).toBe(7);
    expect(mult({ mode: "nolo", ramTeam: null, tricks: [6, 7] }, 1)).toBe(0);
  });

  it("scales the deal by the team's own multiplier", () => {
    const g = st({ mode: "rami", ramTeam: 0, tricks: [9, 4], base: 100 });
    expect(finalScore(g, 0, 0)).toBe(300);
    /* team 1 took four tricks in a rami it did not declare: short, so nothing */
    expect(finalScore(g, 1, 0)).toBe(0);
  });
});

/* The three jokers that name a seat read the run owner and its partner from
   the scoring context, so they fire for an owner seated anywhere. A seat-0
   fixture alone cannot tell a working joker from a hardcoded `=== 2`. */
describe("the jokers that name a seat", () => {
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  /* owner -> its partner, and a seat on the other side. */
  const cases: Array<[Seat, Seat, Seat]> = [
    [0, 2, 1],
    [1, 3, 2],
    [2, 0, 3],
    [3, 1, 0],
  ];
  /* The joker row goes in the *owner's* wallet: scoreTrick scores the side
     scoresFor picked, and it is that side's inventory it reads. A fixture that
     left the row at seat 0 would score an empty wallet for every owner but
     seat 0 and pass nothing. */
  const at = (owner: Seat, ids: string[], winner: Seat, lead: Seat) =>
    scoreTrick(
      withEcon(st(), owner, { jokers: ids.map(joker) }),
      teamOf(owner),
      owner,
      winner,
      lead,
      plain,
    );
  const bare = (winner: Seat, lead: Seat) => scoreTrick(st(), 0, 0, winner, lead, plain);

  it.each(cases)("kaveri fires for the partner of an owner at seat %i", (owner, mate, foe) => {
    expect(at(owner, ["kaveri"], mate, mate).mult - bare(mate, mate).mult).toBe(5);
    expect(at(owner, ["kaveri"], foe, foe).mult - bare(foe, foe).mult).toBe(0);
  });

  it.each(cases)("etukasi fires when an owner at seat %i led", (owner, mate, foe) => {
    expect(at(owner, ["etukasi"], foe, owner).mult - bare(foe, owner).mult).toBe(5);
    expect(at(owner, ["etukasi"], foe, foe).mult - bare(foe, foe).mult).toBe(0);
    /* the partner leading is not the owner leading */
    expect(at(owner, ["etukasi"], foe, mate).mult - bare(foe, mate).mult).toBe(0);
  });

  it.each(cases)("kaksoiskaveri retriggers on the partner of seat %i", (owner, mate, foe) => {
    expect(at(owner, ["kaksoiskaveri"], mate, foe).times).toBe(2);
    expect(at(owner, ["kaksoiskaveri"], foe, mate).times).toBe(2);
    expect(at(owner, ["kaksoiskaveri"], foe, foe).times).toBe(1);
    expect(at(owner, ["kaksoiskaveri"], owner, owner).times).toBe(1);
  });

  /* The two that read the team's own trick count, for the same reason. */
  it("gives ylitikki and tuppisuu the asked team's tricks, not team 0's", () => {
    const g = withEcon(st({ mode: "rami", ramTeam: 1, tricks: [0, 3] }), 1, {
      jokers: [joker("ylitikki")],
    });
    expect(scoreTrick(g, 1, 1, 1, 1, plain).mult - scoreTrick(st(), 0, 0, 1, 1, plain).mult).toBe(
      12,
    );
    /* The same joker in both wallets, so the second assertion is about the
       team the joker is asked about and not about an empty purse. */
    const base = st({ mode: "nolo", ramTeam: null, tricks: [4, 0], jokers: [joker("tuppisuu")] });
    const n = withEcon(base, 1, { jokers: [joker("tuppisuu")] });
    expect(scoreTrick(n, 1, 1, 1, 1, plain).mult).toBe(TYPES.flush.mult * 3);
    expect(scoreTrick(n, 0, 0, 1, 1, plain).mult).toBe(TYPES.flush.mult);
  });
});

/* ==================== whose wallet scores ====================
   The scoring side is the side scoresFor picked, which in nolo and in sooli is
   precisely *not* the trick winner: the game scores the tricks a side dodged.
   So the wallet scoreTrick reads is the owner's — handed the winner's, every
   dodged trick would score an empty purse. */
describe("the wallet a dodged trick scores", () => {
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  /* Nolo, and seat 1 took the trick: team 0 is the side that scores it. */
  const nolo = st({ mode: "nolo", ramTeam: null, tricks: [2, 4] });
  /* nolomestari fires on any nolo trick and the chip bonus is per card, so
     both halves of the wallet show up in the numbers below. */
  const owner = withEcon(nolo, 0, { jokers: [joker("nolomestari")], chipBonus: 4 });
  /* A different inventory at every seat but the owner's — herttaherra scores
     25 a heart and every card here is a heart — so a wallet resolved from the
     winner, or from a literal seat, gives a different answer than one
     resolved from the owner. */
  const others = [1, 2, 3].reduce(
    (g, p) => withEcon(g, p as Seat, { jokers: [joker("herttaherra")], chipBonus: 40 }),
    owner,
  );

  it("scores the owner's jokers and chip bonus, not the winner's", () => {
    const ctx = scoreTrick(owner, 0, 0, 1, 0, plain);
    const bare = scoreTrick(nolo, 0, 0, 1, 0, plain);
    expect(ctx.chips).toBe(bare.chips + 4 * plain.length);
    expect(ctx.mult).toBe(bare.mult + 6);
    expect(ctx.total).toBeGreaterThan(bare.total);
  });

  it("is unchanged when the other three seats hold different wallets", () => {
    expect(scoreTrick(others, 0, 0, 1, 0, plain)).toEqual(scoreTrick(owner, 0, 0, 1, 0, plain));
  });
});

describe("scoring a trick", () => {
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  const score = (cards: typeof plain, over: Partial<GameState> = {}) =>
    scoreTrick(st(over), 0, 0, 0, 0, cards);
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
    expect(scoreTrick(g, 0, 0, 0, 0, plain).mult).toBeCloseTo(base.mult * 1.5);
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
    scoreTrick(g, 0, 0, 0, 0, [C("H", 5, "gold"), C("H", 9), C("H", 2), C("H", 7)]);
    expect(econOf(g, 0).money).toBe(econOf(st(), 0).money);
  });
});

describe("bosses", () => {
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  const punainen = { id: "punainen", key: "boss.punainen" };

  it("zeroes red chips under Punainen kielto", () => {
    expect(chipValue(st({ boss: punainen }), 0, C("H", 9))).toBe(0);
    expect(chipValue(st({ boss: punainen }), 0, C("S", 9))).toBe(9);
  });

  it("removes the trick type's mult under Kasijarru", () => {
    const boss = { id: "kasijarru", key: "boss.kasijarru" };
    expect(scoreTrick(st({ boss }), 0, 0, 0, 0, plain).mult).toBe(1);
  });

  /* chipBonus is on in both tests below, so an effect applied at the wrong
     point in chipValue shows up: with chipBonus 0 the two orders agree. */
  it("zeroes spade chips under Patakielto and leaves a stone card alone", () => {
    const boss = { id: "patakielto", key: "boss.patakielto" };
    const g = st({ boss, chipBonus: 3 });
    expect(chipValue(g, 0, C("S", 9))).toBe(0);
    /* Zeroed after the additions, exactly as Punainen zeroes a red card. */
    expect(chipValue(g, 0, C("S", 9, "bonus"))).toBe(0);
    expect(chipValue(g, 0, C("H", 9))).toBe(12);
    /* A stone card plays with no suit, so the ban cannot reach it. */
    expect(chipValue(g, 0, C("S", 9, "stone"))).toBe(53);
  });

  it("cuts the court cards to five under Kuvakato and leaves the ace and the pips", () => {
    const boss = { id: "kuvakato", key: "boss.kuvakato" };
    const g = st({ boss, chipBonus: 3 });
    for (const r of [11, 12, 13]) expect(chipValue(g, 0, C("H", r))).toBe(8);
    /* The rank value is cut before bonus and chipBonus are added: 5 + 40 + 3. */
    expect(chipValue(g, 0, C("H", 13, "bonus"))).toBe(48);
    /* An ace is worth 11 and is not a court card; the rule names J, Q and K. */
    expect(chipValue(g, 0, C("H", 14))).toBe(14);
    expect(chipValue(g, 0, C("H", 9))).toBe(12);
    expect(chipValue(g, 0, C("H", 13, "stone"))).toBe(53);
  });
});

/* Additions land before multipliers, so purchase order cannot change the
   result. That is a deliberate deviation from Balatro, where the player
   reorders the joker row by hand. */
describe("joker order is locked", () => {
  const withAce = [C("H", 14), C("H", 9), C("H", 2), C("H", 7)];

  it("gives the same mult regardless of purchase order", () => {
    const a = scoreTrick(
      st({ jokers: [joker("assa"), joker("ramikone")] }),
      0,
      0,
      0,
      0,
      withAce,
    ).mult;
    const b = scoreTrick(
      st({ jokers: [joker("ramikone"), joker("assa")] }),
      0,
      0,
      0,
      0,
      withAce,
    ).mult;
    expect(a).toBe(b);
    expect(a).toBe((TYPES.flush.mult + 6) * 2);
  });
});

describe("enhancement jokers", () => {
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  const stoneTrick = [C("S", 2, "stone"), C("H", 9), C("H", 2), C("H", 7)];

  it("gives Kivenveistaja +70 chips per stone card", () => {
    const withJoker = scoreTrick(
      st({ jokers: [joker("kivenveistaja")] }),
      0,
      0,
      0,
      0,
      stoneTrick,
    ).chips;
    expect(withJoker - scoreTrick(st(), 0, 0, 0, 0, stoneTrick).chips).toBe(70);
  });

  it("gives Pakkamestari x0.2 per enhanced side-deck card", () => {
    const g = st({
      jokers: [joker("pakkamestari")],
      sideDeck: [C("S", 2, "stone"), C("H", 3, "gold")],
    });
    expect(scoreTrick(g, 0, 0, 0, 0, plain).mult).toBe(TYPES.flush.mult * 1.4);
  });

  it("reads money through the context, not the state", () => {
    const rich = scoreTrick(st({ jokers: [joker("ahne")], money: 40 }), 0, 0, 0, 0, plain).mult;
    const poor = scoreTrick(st({ jokers: [joker("ahne")], money: 0 }), 0, 0, 0, 0, plain).mult;
    expect(rich).toBeGreaterThan(poor);
  });
});

/* Support is a counter, and scoreTrick's ScoreState deliberately does not
   include it. This is what makes that true rather than merely intended. */
describe("support cannot move the score", () => {
  it("scores identically whatever the support tally says", () => {
    const cards = [C("H", 14), C("H", 13), C("H", 5), C("S", 9)];
    const flat = st({ support: { kahvi: 0, sauna: 0 } });
    const loaded = st({ support: { kahvi: 40, sauna: 9 } });

    const a = scoreTrick(flat, 0, 0, 0, 0, cards);
    const b = scoreTrick(loaded, 0, 0, 0, 0, cards);

    expect(a.total).toBeGreaterThan(0);
    expect(b.total).toBe(a.total);
    expect(b.chips).toBe(a.chips);
    expect(b.mult).toBe(a.mult);
    expect(b.payout).toBe(a.payout);
  });
});
