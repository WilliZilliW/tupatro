/* Scoring: trick types, the tuppi multiplier table, card enhancements, bosses
   and the locked calculation order. */
import { group, ok, eq, near } from "./harness.js";
import { mkCard, chipValue } from "../src/cards.js";
import { evalTrick, scoreTrick, tuppiInfo } from "../src/scoring.js";
import { TYPES } from "../src/constants.js";
import { JOKERS } from "../src/content.js";

const C = (s, r, e) => mkCard(s, r, e);

function st(over) {
  return Object.assign(
    {
      sooli: false,
      sooliBust: false,
      boss: null,
      chipBonus: 0,
      tuppiBonus: 0,
      mode: "rami",
      ramTeam: 0,
      usTricks: 0,
      themTricks: 0,
      scored: 0,
      jokers: [],
      sideDeck: [],
      trick: [],
      hands: [[], [], [], []],
      money: 0,
    },
    over || {},
  );
}
const joker = (id) => JOKERS.find((j) => j.id === id);

group("Trick types");
{
  const ty = (cs) => evalTrick(cs).id;
  eq("flush", ty([C("H", 2), C("H", 7), C("H", 9), C("H", 13)]), "flush");
  eq("mixed trick", ty([C("H", 2), C("S", 7), C("D", 9), C("C", 12)]), "high");
  eq("pair", ty([C("H", 7), C("S", 7), C("D", 9), C("C", 12)]), "pair");
  eq("two pair", ty([C("H", 7), C("S", 7), C("D", 9), C("C", 9)]), "twopair");
  eq("three of a kind", ty([C("H", 7), C("S", 7), C("D", 7), C("C", 12)]), "trips");
  eq("four of a kind", ty([C("H", 7), C("S", 7), C("D", 7), C("C", 7)]), "quad");
  eq("straight", ty([C("H", 5), C("S", 6), C("D", 7), C("C", 8)]), "straight");
  eq("straight flush", ty([C("H", 5), C("H", 6), C("H", 7), C("H", 8)]), "sf");
  eq("three-card trick (sooli)", ty([C("H", 5), C("H", 6), C("H", 7)]), "sf");
}

/* In tuppi: rami 7 tricks = 4 points and each further trick +4, so the multiplier
   is tricks-6. Nolo: 6 tricks = 4 points and each trick fewer +4, so it is
   7-tricks. Ryosto doubles it. A sooli is worth 24 points = 6 x 4. */
group("Tuppi multiplier");
{
  const mult = (over) => tuppiInfo(st(over)).mult;
  eq("rami 6 tricks = short, scores nothing", mult({ mode: "rami", ramTeam: 0, usTricks: 6 }), 0);
  eq("rami 7 tricks = x1", mult({ mode: "rami", ramTeam: 0, usTricks: 7 }), 1);
  eq("rami 9 tricks = x3", mult({ mode: "rami", ramTeam: 0, usTricks: 9 }), 3);
  eq("rami 13 tricks = x7", mult({ mode: "rami", ramTeam: 0, usTricks: 13 }), 7);
  eq("ryosto 7 tricks = x2", mult({ mode: "rami", ramTeam: 1, usTricks: 7 }), 2);
  eq("ryosto 9 tricks = x6", mult({ mode: "rami", ramTeam: 1, usTricks: 9 }), 6);
  eq("nolo 6 tricks = x1", mult({ mode: "nolo", ramTeam: null, usTricks: 6 }), 1);
  eq("nolo 3 tricks = x4", mult({ mode: "nolo", ramTeam: null, usTricks: 3 }), 4);
  eq("nolo 0 tricks = x7", mult({ mode: "nolo", ramTeam: null, usTricks: 0 }), 7);
  eq("nolo 7 tricks = collapsed", mult({ mode: "nolo", ramTeam: null, usTricks: 7 }), 0);
  eq("a clean sooli = x6", mult({ sooli: true, usTricks: 0 }), 6);
  eq("a busted sooli = 0", mult({ sooli: true, sooliBust: true, usTricks: 1 }), 0);
}

group("Tuppi multiplier: jokers, vouchers and boss");
{
  const mult = (over) => tuppiInfo(st(over)).mult;
  eq(
    "Vanha Tuppi joker +1",
    mult({ mode: "rami", ramTeam: 0, usTricks: 7, jokers: [joker("vanhatuppi")] }),
    2,
  );
  eq("Tuppisormus voucher +1", mult({ mode: "rami", ramTeam: 0, usTricks: 7, tuppiBonus: 1 }), 2);
  eq(
    "Kitsas kerroin boss -1",
    mult({ mode: "rami", ramTeam: 0, usTricks: 9, boss: { id: "kitsas" } }),
    2,
  );
  eq(
    "multiplier never drops below x1 when the tricks suffice",
    mult({ mode: "rami", ramTeam: 0, usTricks: 7, boss: { id: "kitsas" } }),
    1,
  );
}

group("Scoring");
{
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  const score = (cards, over) => scoreTrick(st(over), 0, 0, cards);
  const base = score(plain);
  eq("flush: chips = 30 base + card values", base.chips, TYPES.flush.chips + 5 + 9 + 2 + 7);
  eq("flush: mult = 2", base.mult, TYPES.flush.mult);
  eq("total = chips x mult", base.total, base.chips * base.mult);

  eq(
    "bonus card +40 chips",
    score([C("H", 5, "bonus"), C("H", 9), C("H", 2), C("H", 7)]).chips - base.chips,
    40,
  );
  eq(
    "mult card +5 mult",
    score([C("H", 5, "mult"), C("H", 9), C("H", 2), C("H", 7)]).mult - base.mult,
    5,
  );
  eq(
    "glass card x2 chips",
    score([C("H", 5, "glass"), C("H", 9), C("H", 2), C("H", 7)]).chips,
    base.chips * 2,
  );

  const steelState = st();
  steelState.hands[0] = [C("D", 3, "steel")];
  near("steel card in hand x1.5 mult", scoreTrick(steelState, 0, 0, plain).mult, base.mult * 1.5);
  eq("steel card has no effect once played", score(plain).mult, base.mult);

  const goldState = st();
  scoreTrick(goldState, 0, 0, [C("H", 5, "gold"), C("H", 9), C("H", 2), C("H", 7)]);
  eq("gold card +$3", goldState.money, 3);
  const twoGold = st();
  scoreTrick(twoGold, 0, 0, [C("H", 5, "gold"), C("H", 9, "gold"), C("H", 2), C("H", 7)]);
  eq("two gold cards +$6", twoGold.money, 6);
}

group("Scoring: bosses");
{
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  eq("Punainen kielto zeroes red chips", chipValue(st({ boss: { id: "punainen" } }), C("H", 9)), 0);
  eq("  blacks are unaffected", chipValue(st({ boss: { id: "punainen" } }), C("S", 9)), 9);
  eq(
    "Kasijarru: trick type gives no mult",
    scoreTrick(st({ boss: { id: "kasijarru" } }), 0, 0, plain).mult,
    1,
  );
}

group("Scoring: joker order");
{
  /* Additions land before multipliers, so purchase order must not change the
     result. That is a deliberate deviation from Balatro, where the player
     reorders the joker row by hand. */
  const withAce = [C("H", 14), C("H", 9), C("H", 2), C("H", 7)];
  const a = scoreTrick(st({ jokers: [joker("assa"), joker("ramikone")] }), 0, 0, withAce).mult;
  const b = scoreTrick(st({ jokers: [joker("ramikone"), joker("assa")] }), 0, 0, withAce).mult;
  eq("purchase order does not change mult", a, b);
  eq("  and the multiplier lands after the sum", a, (TYPES.flush.mult + 6) * 2);
}

group("Scoring: enhancement jokers");
{
  const stoneTrick = [C("S", 2, "stone"), C("H", 9), C("H", 2), C("H", 7)];
  eq(
    "Kivenveistaja +70 chips per stone",
    scoreTrick(st({ jokers: [joker("kivenveistaja")] }), 0, 0, stoneTrick).chips -
      scoreTrick(st(), 0, 0, stoneTrick).chips,
    70,
  );
  const plain = [C("H", 5), C("H", 9), C("H", 2), C("H", 7)];
  eq(
    "Pakkamestari x0.2 per enhanced card in the side deck",
    scoreTrick(
      st({
        jokers: [joker("pakkamestari")],
        sideDeck: [C("S", 2, "stone"), C("H", 3, "gold")],
      }),
      0,
      0,
      plain,
    ).mult,
    TYPES.flush.mult * 1.4,
  );
  ok(
    "jokers read money through the context, not the state",
    scoreTrick(st({ jokers: [joker("ahne")], money: 40 }), 0, 0, plain).mult >
      scoreTrick(st({ jokers: [joker("ahne")], money: 0 }), 0, 0, plain).mult,
  );
}
