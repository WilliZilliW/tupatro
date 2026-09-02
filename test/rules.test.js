/* Trick rules: the follow-suit obligation, the winner, and the two enhancements
   that bend those rules. These import the real modules -- the rule functions are
   pure and take the state explicitly, so no DOM is involved. */
import { group, ok, eq } from "./harness.js";
import { mkCard, isStone, isWild, matchesSuit, rv, chipValue } from "../src/cards.js";
import { leadSuit, legalCards, currentWinner, scoresForUs, trickSize } from "../src/rules.js";
import { evalTrick } from "../src/scoring.js";
import { makeDeck } from "../src/cards.js";
import { ANTES } from "../src/constants.js";
import { ENH, JOKERS } from "../src/content.js";
import { descOf, nameOf, setLocale } from "../src/i18n.js";

const C = (s, r, e) => mkCard(s, r, e);

/* A minimal state: the rule functions only read what they need, so tests can
   build one by hand instead of booting a whole run. */
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

group("Follow-suit obligation");
{
  const g = st({ trick: [{ p: 1, card: C("H", 13) }] });
  g.hands[0] = [C("H", 5), C("C", 9), C("S", 3)];
  eq("must follow the led suit when holding it", legalCards(g, 0).length, 1);
  eq("  and it is the right card", legalCards(g, 0)[0].id, "H5");
  g.hands[0] = [C("C", 9), C("S", 3)];
  eq("void in the suit: anything is legal", legalCards(g, 0).length, 2);
  g.trick = [];
  eq("the leader may play anything", legalCards(g, 0).length, 2);
}

group("Trick winner (no trump)");
{
  const g = st({
    trick: [
      { p: 0, card: C("H", 9) },
      { p: 1, card: C("H", 13) },
      { p: 2, card: C("S", 14) },
      { p: 3, card: C("H", 4) },
    ],
  });
  eq("highest card of the led suit wins", currentWinner(g).p, 1);
  ok("another suit loses even as an ace", currentWinner(g).card.id !== "S14");

  const a = C("S", 14);
  const b = C("S", 14);
  ok("duplicates get distinct uids", a.uid !== b.uid && a.id === b.id);
  const t = st({
    trick: [
      { p: 1, card: a },
      { p: 2, card: b },
    ],
  });
  eq("a tie goes to the card played earlier", currentWinner(t).p, 1);
}

group("Stone card (no suit, no rank)");
{
  const g = st({ trick: [{ p: 1, card: C("H", 13) }] });
  g.hands[0] = [C("H", 5), C("S", 2, "stone"), C("C", 9)];
  const legal = legalCards(g, 0);
  ok("stone is legal even when the suit could be followed", legal.some(isStone));
  ok("  but another wrong suit is not", !legal.some((c) => c.id === "C9"));
  eq("  legal cards in total", legal.length, 2);

  /* Printed as the ace of hearts on purpose: read as an ordinary card it would
     win the trick. The rule is that it cannot. */
  const h = st({
    trick: [
      { p: 1, card: C("H", 3) },
      { p: 2, card: C("H", 14, "stone") },
      { p: 3, card: C("H", 2) },
    ],
  });
  eq("stone does not win even with the highest printed rank", currentWinner(h).p, 1);

  const alone = st({
    trick: [
      { p: 1, card: C("H", 14, "stone") },
      { p: 2, card: C("H", 3) },
    ],
  });
  eq("stone does not win even as the sole high card", currentWinner(alone).p, 2);

  const led = st({
    trick: [
      { p: 0, card: C("S", 2, "stone") },
      { p: 1, card: C("D", 4) },
      { p: 2, card: C("D", 9) },
    ],
  });
  eq("stone does not set the led suit", leadSuit(led), "D");
  eq("  the suit comes from the next card", currentWinner(led).p, 2);

  eq("stone is worth 50 chips", chipValue(st(), C("S", 2, "stone")), 50);
  eq(
    "stone is excluded from the trick type",
    evalTrick([C("H", 5), C("H", 9), C("H", 2), C("S", 2, "stone")]).id,
    "flush",
  );
}

group("Wild card");
{
  const g = st({ trick: [{ p: 1, card: C("H", 13) }] });
  g.hands[0] = [C("C", 9, "wild"), C("D", 4)];
  eq("wild satisfies the follow-suit obligation", legalCards(g, 0).length, 1);
  ok("  and it is the wild card", isWild(legalCards(g, 0)[0]));

  const w = st({
    trick: [
      { p: 1, card: C("H", 13) },
      { p: 2, card: C("C", 14, "wild") },
    ],
  });
  eq("wild can win the trick", currentWinner(w).p, 2);
  eq(
    "wild completes a flush",
    evalTrick([C("H", 5), C("H", 9), C("H", 2), C("C", 7, "wild")]).id,
    "flush",
  );
  ok(
    "wild is not stone",
    matchesSuit(C("C", 7, "wild"), "H") && !matchesSuit(C("S", 2, "stone"), "H"),
  );
}

group("Which side scores");
{
  const forUs = (mode, winner, sooli) => scoresForUs(st({ mode, sooli: !!sooli }), winner);
  ok("in rami you score the tricks you win", forUs("rami", 0) && forUs("rami", 2));
  ok("  not the opponents'", !forUs("rami", 1) && !forUs("rami", 3));
  ok("in nolo you score the ones you dodge", forUs("nolo", 1) && forUs("nolo", 3));
  ok("  not your own tricks", !forUs("nolo", 0) && !forUs("nolo", 2));
  ok("in sooli you score the dodged tricks", forUs("rami", 1, true) && !forUs("rami", 0, true));
}

group("Deck and structure");
{
  const deck = makeDeck();
  eq("the deck holds 52 cards", deck.length, 52);
  eq("all individuals unique", new Set(deck.map((c) => c.uid)).size, 52);
  eq("all card types distinct", new Set(deck.map((c) => c.id)).size, 52);
  eq("8 antes", ANTES.length, 8);
  ok(
    "ante thresholds increase",
    ANTES.every((v, i) => i === 0 || v > ANTES[i - 1]),
  );
  eq("7 enhancements", Object.keys(ENH).length, 7);
  ok("at least 20 jokers", JOKERS.length >= 20);
  eq("jokers have unique ids", new Set(JOKERS.map((j) => j.id)).size, JOKERS.length);
  setLocale("fi");
  ok(
    "jokers have a key, price and rarity",
    JOKERS.every((j) => j.key && j.p > 0 && j.r),
  );
  ok(
    "every joker resolves to a name and a description",
    JOKERS.every((j) => nameOf(j) !== j.key + ".n" && descOf(j) !== j.key + ".t"),
  );
  ok(
    "enhancements have a key, price and glyph",
    Object.keys(ENH).every((k) => ENH[k].key && ENH[k].p > 0 && ENH[k].g),
  );
  eq("trick size is normally 4", trickSize(st()), 4);
  eq("trick size in sooli is 3", trickSize(st({ sooli: true })), 3);
  eq("the ace is lowest in sooli", rv(st({ sooli: true }), C("S", 14)), 1);
  eq("  and highest otherwise", rv(st(), C("S", 14)), 14);
}

group("Content stays pure data");
{
  /* The joker table must not reach for module state: everything it needs arrives
     through the scoring context. */
  const src = JOKERS.map((j) =>
    [j.add, j.xm, j.retrig, j.won].filter(Boolean).map(String).join(""),
  ).join("");
  ok("no joker effect references the G binding", !/\bG\./.test(src), src.match(/\bG\.\w+/g) + "");
}
