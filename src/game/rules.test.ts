/* Trick rules: the follow-suit obligation, the winner, and the two
   enhancements that bend those rules. These import the real modules — the rule
   functions are pure and take state explicitly, so no DOM is involved. */
import { describe, expect, it } from "vitest";
import { chipValue, isStone, isWild, matchesSuit, partyOf, rv } from "./cards";
import { ANTES, BLIND_KEYS, BLIND_MARKS, BLIND_MULT, BLIND_REWARD } from "./constants";
import { BIG_BOSSES, BOSSES, ENH, JOKERS, PARTIES, PARTY_IDS, SMALL_BOSSES } from "./content";
import { currentWinner, leadSuit, legalCards, scoresForUs, trickSize } from "./rules";
import { evalTrick } from "./scoring";
import { rollCardOffer } from "./shop";
import { makeRng } from "./rng";
import { createRun } from "./state";
import { nameOfIn, descOfIn } from "../i18n";
import { card as C, freshDeck, st } from "../test/factories";

describe("maantuntopakko", () => {
  it("must follow the led suit when holding it", () => {
    const g = st({ trick: [{ p: 1, card: C("H", 13) }] });
    g.hands[0] = [C("H", 5), C("C", 9), C("S", 3)];
    expect(legalCards(g, 0)).toHaveLength(1);
    expect(legalCards(g, 0)[0].id).toBe("H5");
  });

  it("allows anything when void in the suit", () => {
    const g = st({ trick: [{ p: 1, card: C("H", 13) }] });
    g.hands[0] = [C("C", 9), C("S", 3)];
    expect(legalCards(g, 0)).toHaveLength(2);
  });

  it("lets the leader play anything", () => {
    const g = st();
    g.hands[0] = [C("C", 9), C("S", 3)];
    expect(legalCards(g, 0)).toHaveLength(2);
  });
});

describe("trick winner (no trump)", () => {
  it("gives the trick to the highest card of the led suit", () => {
    const g = st({
      trick: [
        { p: 0, card: C("H", 9) },
        { p: 1, card: C("H", 13) },
        { p: 2, card: C("S", 14) },
        { p: 3, card: C("H", 4) },
      ],
    });
    expect(currentWinner(g)?.p).toBe(1);
    expect(currentWinner(g)?.card.id).not.toBe("S14");
  });

  it("gives duplicates distinct uids", () => {
    const a = C("S", 14);
    const b = C("S", 14);
    expect(a.uid).not.toBe(b.uid);
    expect(a.id).toBe(b.id);
  });

  /* A strictly greater comparison: a tie goes to the card played earlier.
     Do not change it to >=. */
  it("breaks a tie in favour of the card played earlier", () => {
    const a = C("S", 14);
    const b = C("S", 14);
    const g = st({
      trick: [
        { p: 1, card: a },
        { p: 2, card: b },
      ],
    });
    expect(currentWinner(g)?.p).toBe(1);
  });
});

describe("stone card (no suit, no rank)", () => {
  it("is legal even when the led suit could be followed", () => {
    const g = st({ trick: [{ p: 1, card: C("H", 13) }] });
    g.hands[0] = [C("H", 5), C("S", 2, "stone"), C("C", 9)];
    const legal = legalCards(g, 0);
    expect(legal.some(isStone)).toBe(true);
    expect(legal.some((c) => c.id === "C9")).toBe(false);
    expect(legal).toHaveLength(2);
  });

  /* Printed as the ace of hearts on purpose: read as an ordinary card it
     would win the trick. The rule is that it cannot. */
  it("does not win even with the highest printed rank", () => {
    const g = st({
      trick: [
        { p: 1, card: C("H", 3) },
        { p: 2, card: C("H", 14, "stone") },
        { p: 3, card: C("H", 2) },
      ],
    });
    expect(currentWinner(g)?.p).toBe(1);
  });

  it("does not win even as the sole high card", () => {
    const g = st({
      trick: [
        { p: 1, card: C("H", 14, "stone") },
        { p: 2, card: C("H", 3) },
      ],
    });
    expect(currentWinner(g)?.p).toBe(2);
  });

  it("does not set the led suit", () => {
    const g = st({
      trick: [
        { p: 0, card: C("S", 2, "stone") },
        { p: 1, card: C("D", 4) },
        { p: 2, card: C("D", 9) },
      ],
    });
    expect(leadSuit(g)).toBe("D");
    expect(currentWinner(g)?.p).toBe(2);
  });

  it("is worth 50 chips and stays out of the trick type", () => {
    expect(chipValue(st(), C("S", 2, "stone"))).toBe(50);
    expect(evalTrick([C("H", 5), C("H", 9), C("H", 2), C("S", 2, "stone")]).id).toBe("flush");
  });
});

describe("wild card", () => {
  it("satisfies the follow-suit obligation", () => {
    const g = st({ trick: [{ p: 1, card: C("H", 13) }] });
    g.hands[0] = [C("C", 9, "wild"), C("D", 4)];
    expect(legalCards(g, 0)).toHaveLength(1);
    expect(isWild(legalCards(g, 0)[0])).toBe(true);
  });

  it("can win the trick and completes a flush", () => {
    const g = st({
      trick: [
        { p: 1, card: C("H", 13) },
        { p: 2, card: C("C", 14, "wild") },
      ],
    });
    expect(currentWinner(g)?.p).toBe(2);
    expect(evalTrick([C("H", 5), C("H", 9), C("H", 2), C("C", 7, "wild")]).id).toBe("flush");
  });

  it("is not stone", () => {
    expect(matchesSuit(C("C", 7, "wild"), "H")).toBe(true);
    expect(matchesSuit(C("S", 2, "stone"), "H")).toBe(false);
  });
});

describe("which side scores", () => {
  const forUs = (mode: "rami" | "nolo", winner: 0 | 1 | 2 | 3, sooli = false) =>
    scoresForUs(st({ mode, sooli }), winner);

  it("scores your own tricks in rami", () => {
    expect(forUs("rami", 0)).toBe(true);
    expect(forUs("rami", 2)).toBe(true);
    expect(forUs("rami", 1)).toBe(false);
    expect(forUs("rami", 3)).toBe(false);
  });

  it("scores the dodged tricks in nolo", () => {
    expect(forUs("nolo", 1)).toBe(true);
    expect(forUs("nolo", 3)).toBe(true);
    expect(forUs("nolo", 0)).toBe(false);
    expect(forUs("nolo", 2)).toBe(false);
  });

  it("scores the dodged tricks in sooli", () => {
    expect(forUs("rami", 1, true)).toBe(true);
    expect(forUs("rami", 0, true)).toBe(false);
  });
});

describe("deck and structure", () => {
  it("builds a 52-card deck of unique individuals", () => {
    const deck = freshDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => c.uid)).size).toBe(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it("has ten rising ante thresholds", () => {
    expect(ANTES).toHaveLength(10);
    expect(ANTES.every((v, i) => i === 0 || v > ANTES[i - 1])).toBe(true);
    expect(ANTES.slice(-2)).toEqual([16000, 25000]);
  });

  /* An ante is four blinds, and four tables describe them. A table left one
     short reads as undefined at the blind select rather than as an error. */
  it("describes the same four blinds in every blind table", () => {
    expect(BLIND_MULT).toEqual([1, 1.5, 2, 2.5]);
    expect(BLIND_REWARD).toEqual([3, 4, 5, 6]);
    expect(BLIND_KEYS).toHaveLength(BLIND_MULT.length);
    expect(BLIND_REWARD).toHaveLength(BLIND_MULT.length);
    expect(BLIND_MARKS).toHaveLength(BLIND_MULT.length);
    expect(new Set(BLIND_MARKS).size).toBe(BLIND_MARKS.length);
  });

  /* The two boss blinds draw from different pools, so an ante shows two
     different bosses; BOSSES stays the one table save.ts looks a boss up in. */
  it("splits the bosses into two disjoint pools that make up BOSSES", () => {
    expect(BOSSES).toHaveLength(10);
    expect(new Set(BOSSES.map((b) => b.id)).size).toBe(10);
    expect(BOSSES).toEqual([...SMALL_BOSSES, ...BIG_BOSSES]);
    const small = new Set(SMALL_BOSSES.map((b) => b.id));
    expect(BIG_BOSSES.filter((b) => small.has(b.id))).toEqual([]);
    expect(SMALL_BOSSES.map((b) => b.id)).toEqual([
      "kitsas",
      "pakkorami",
      "patakielto",
      "kuvakato",
      "verokarhu",
    ]);
    expect(BIG_BOSSES.map((b) => b.id)).toEqual([
      "punainen",
      "kasijarru",
      "umpimahka",
      "kiire",
      "harmaus",
    ]);
  });

  it("has seven enhancements and at least twenty distinct jokers", () => {
    expect(Object.keys(ENH)).toHaveLength(7);
    expect(JOKERS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(JOKERS.map((j) => j.id)).size).toBe(JOKERS.length);
  });

  it("resolves every joker to a name and a description", () => {
    for (const j of JOKERS) {
      expect(j.key && j.p > 0 && j.r).toBeTruthy();
      expect(nameOfIn("fi", j)).not.toBe(j.key + ".n");
      expect(descOfIn("fi", j)).not.toBe(j.key + ".t");
    }
  });

  it("shrinks the trick to three in sooli and makes the ace lowest", () => {
    expect(trickSize(st())).toBe(4);
    expect(trickSize(st({ sooli: true }))).toBe(3);
    expect(rv(st({ sooli: true }), C("S", 14))).toBe(1);
    expect(rv(st(), C("S", 14))).toBe(14);
  });
});

describe("content stays pure data", () => {
  /* The joker table must not reach for module state: everything it needs
     arrives through the scoring context. */
  it("has no joker effect that reaches for game state", () => {
    const src = JOKERS.map((j) =>
      [j.add, j.xm, j.retrig, j.won].filter(Boolean).map(String).join(""),
    ).join("");
    expect(src).not.toMatch(/\bg\.\w+/);
    expect(src).not.toMatch(/\bG\.\w+/);
  });
});

describe("parties", () => {
  /* The emblems are no longer here: they abbreviate a translated name, so their
     shape, uniqueness and blocklist are checked per locale in i18n.test.ts. */
  it("has thirteen parties with distinct ids", () => {
    expect(PARTIES).toHaveLength(13);
    expect(new Set(PARTIES.map((p) => p.id)).size).toBe(13);
    expect(PARTY_IDS).toEqual(PARTIES.map((p) => p.id));
  });

  it("resolves every party to a name and a description", () => {
    for (const p of PARTIES) {
      expect(nameOfIn("fi", p)).not.toBe(p.key + ".n");
      expect(descOfIn("fi", p)).not.toBe(p.key + ".t");
    }
  });

  /* The party is a property of the card type, which is what makes a side-deck
     twin and the hand card it replaces agree without any minting change. */
  it("reads the party off the card type, not the individual", () => {
    const g = st();
    expect(partyOf(g, C("S", 14))).toBe(g.partyMap["S14"]);
    expect(PARTY_IDS).toContain(partyOf(g, C("S", 14)));
    expect(partyOf(g, C("S", 14, "steel"))).toBe(partyOf(g, C("S", 14)));
    /* Two separately minted aces of spades: different uids, same party. */
    const a = C("S", 14);
    const b = C("S", 14);
    expect(a.uid).not.toBe(b.uid);
    expect(partyOf(g, a)).toBe(partyOf(g, b));
    /* A stone card has neither suit nor rank in play, but it has a party. */
    expect(partyOf(g, C("S", 14, "stone"))).toBe(partyOf(g, C("S", 14)));
  });

  /* A shop offer's `card` is `{ s, r, enh }` with no `id` and no `uid`. Keying
     the lookup off `id` would resolve every offer to the same party, which is
     exactly the silent misattribution a fallback would have hidden. */
  it("resolves a card-shaped value that carries no id", () => {
    const g = st();
    const offer = rollCardOffer(makeRng(7));
    expect("id" in offer.card).toBe(false);
    expect(partyOf(g, offer.card)).toBe(g.partyMap[offer.card.s + offer.card.r]);
    expect(PARTY_IDS).toContain(partyOf(g, offer.card));
  });

  it("adds no field to Card", () => {
    expect(Object.keys(C("S", 14)).sort()).toEqual(["enh", "id", "r", "s", "uid"]);
  });

  /* shuffle permutes in place, so rolling a run must shuffle a copy: the rail
     plate's fixed order is PARTY_IDS. */
  it("does not reorder PARTY_IDS when a run is rolled", () => {
    const before = PARTY_IDS.slice();
    createRun("PUOLUE");
    createRun("TOINEN");
    expect(PARTY_IDS).toEqual(before);
    expect(PARTY_IDS).toEqual(PARTIES.map((p) => p.id));
  });
});
