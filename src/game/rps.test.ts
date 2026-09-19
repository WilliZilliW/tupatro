import { describe, expect, it } from "vitest";
import { makeMint, mkCard } from "./cards";
import { RPS_HAND, RPS_ROUNDS } from "./constants";
import { beats, makeRpsDeck, RPS_THROWS, rpsCompare, rpsOver, rpsThrowOf, rpsWinner } from "./rps";
import type { Card, RpsThrow, Suit } from "./types";

const mint = makeMint(0);
const card = (s: Suit, r: number): Card => mkCard(mint, s, r);

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

describe("makeRpsDeck", () => {
  const deck = makeRpsDeck(makeMint(0));

  it("holds exactly 41 cards", () => {
    expect(deck).toHaveLength(41);
  });

  it("holds all thirteen of each of hearts, spades and diamonds", () => {
    for (const s of ["H", "S", "D"] as const) {
      const suited = deck.filter((c) => c.s === s);
      expect(suited).toHaveLength(13);
      expect(suited.map((c) => c.r).sort((a, b) => a - b)).toEqual([
        2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
      ]);
    }
  });

  it("holds exactly two clubs, the king and the queen", () => {
    const clubs = deck.filter((c) => c.s === "C");
    expect(clubs).toHaveLength(2);
    expect(clubs.map((c) => c.r).sort((a, b) => b - a)).toEqual([13, 12]);
  });

  it("mints 41 distinct uids", () => {
    expect(new Set(deck.map((c) => c.uid)).size).toBe(41);
  });

  it("deals no enhanced card: this mode has no shop and no tuppipakka", () => {
    for (const c of deck) expect(c.enh).toBeNull();
  });

  it("takes the caller's own Mint rather than making one", () => {
    const m = makeMint(100);
    const d = makeRpsDeck(m);
    expect(m.seq).toBe(141);
    expect(d[0].uid).toBe("c101");
  });

  it("deals two hands of RPS_HAND out of it with room to spare", () => {
    expect(RPS_HAND * 2).toBeLessThan(deck.length);
  });
});

describe("rpsThrowOf", () => {
  it.each([
    ["H", "paper"],
    ["S", "rock"],
    ["D", "scissors"],
  ] as Array<[Suit, RpsThrow]>)("reads %s as %s", (s, th) => {
    expect(rpsThrowOf(card(s, 7))).toBe(th);
  });

  it("answers null for both clubs: they are not throws", () => {
    expect(rpsThrowOf(card("C", 13))).toBeNull();
    expect(rpsThrowOf(card("C", 12))).toBeNull();
  });

  it("reads the suit and never the rank", () => {
    for (let r = 2; r <= 14; r++) expect(rpsThrowOf(card("H", r))).toBe("paper");
  });
});

/* The whole 5x5 table over the classes {♥, ♠, ♦, ♣K, ♣Q}. The ranks are
   arbitrary within a suit on purpose — rank decides nothing — and the two
   clubs are the only cards whose rank is part of their identity. */
describe("rpsCompare", () => {
  const H = card("H", 5);
  const S = card("S", 9);
  const D = card("D", 14);
  const CK = card("C", 13);
  const CQ = card("C", 12);

  it.each([
    ["rock takes scissors", S, D],
    ["scissors take paper", D, H],
    ["paper takes rock", H, S],
  ] as Array<[string, Card, Card]>)("%s", (_label, a, b) => {
    expect(rpsCompare(a, b)).toBe(1);
    expect(rpsCompare(b, a)).toBe(-1);
  });

  it.each([
    ["two hearts", card("H", 2), card("H", 14)],
    ["two spades", card("S", 3), card("S", 11)],
    ["two diamonds", card("D", 4), card("D", 13)],
  ] as Array<[string, Card, Card]>)("%s tie the round", (_label, a, b) => {
    expect(rpsCompare(a, b)).toBe(0);
    expect(rpsCompare(b, a)).toBe(0);
  });

  it.each([
    ["a heart", H],
    ["a spade", S],
    ["a diamond", D],
    ["the queen of clubs", CQ],
  ] as Array<[string, Card]>)("the king of clubs beats %s", (_label, other) => {
    expect(rpsCompare(CK, other)).toBe(1);
    expect(rpsCompare(other, CK)).toBe(-1);
  });

  it.each([
    ["a heart", H],
    ["a spade", S],
    ["a diamond", D],
  ] as Array<[string, Card]>)("the queen of clubs beats %s", (_label, other) => {
    expect(rpsCompare(CQ, other)).toBe(1);
    expect(rpsCompare(other, CQ)).toBe(-1);
  });

  it("the queen of clubs loses to the king of clubs and to nothing else", () => {
    expect(rpsCompare(CQ, CK)).toBe(-1);
  });

  /* Antisymmetry over the whole deck: 41 x 41 ordered pairs, including a card
     against itself. A table that read a rank anywhere, or that gave either
     club a second win condition, breaks here rather than in a match. */
  it("is antisymmetric over every ordered pair of the 41-card deck", () => {
    const deck = makeRpsDeck(makeMint(0));
    for (const a of deck) {
      for (const b of deck) {
        /* Stated as a sum rather than as `toBe(-rpsCompare(b, a))`: negating
           a 0 gives -0, which toBe distinguishes from 0. */
        expect(rpsCompare(a, b) + rpsCompare(b, a)).toBe(0);
      }
    }
  });

  /* No high-card tie-break can creep in: replacing either card's rank with
     any other rank of the same suit leaves the outcome alone. The two clubs
     are excluded because their rank *is* their identity. */
  it("is blind to rank within a suit", () => {
    const suits: Suit[] = ["H", "S", "D"];
    for (const sa of suits) {
      for (const sb of suits) {
        const base = rpsCompare(card(sa, 2), card(sb, 2));
        for (let ra = 2; ra <= 14; ra++) {
          for (let rb = 2; rb <= 14; rb++) {
            expect(rpsCompare(card(sa, ra), card(sb, rb))).toBe(base);
          }
        }
      }
    }
  });

  it("is blind to rank against either club too", () => {
    for (const club of [card("C", 13), card("C", 12)]) {
      for (const s of ["H", "S", "D"] as Suit[]) {
        for (let r = 2; r <= 14; r++) {
          expect(rpsCompare(club, card(s, r))).toBe(1);
          expect(rpsCompare(card(s, r), club)).toBe(-1);
        }
      }
    }
  });
});

describe("rpsOver / rpsWinner", () => {
  it("is over once RPS_ROUNDS rounds have been played, and not before", () => {
    expect(RPS_ROUNDS).toBe(3);
    expect(rpsOver(0)).toBe(false);
    expect(rpsOver(1)).toBe(false);
    expect(rpsOver(2)).toBe(false);
    expect(rpsOver(3)).toBe(true);
  });

  /* The match does not stop at two wins any more: two wins in the first two
     rounds is not over, the third round is still played. */
  it("is not over at two wins with a round still to play", () => {
    expect(rpsOver(2)).toBe(false);
  });

  it.each([
    { wins: [3, 0] as [number, number], winner: 0 as const },
    { wins: [2, 1] as [number, number], winner: 0 as const },
    { wins: [2, 0] as [number, number], winner: 0 as const },
    { wins: [1, 2] as [number, number], winner: 1 as const },
    { wins: [0, 3] as [number, number], winner: 1 as const },
    /* Every level pair is a draw — including 0-0, which three tied rounds
       produce, and 1-1, which a tie plus one round each does. */
    { wins: [0, 0] as [number, number], winner: "draw" as const },
    { wins: [1, 1] as [number, number], winner: "draw" as const },
  ])("wins $wins", ({ wins, winner }) => {
    expect(rpsWinner(wins)).toBe(winner);
  });

  /* The one silent failure this rework can produce: a draw returned as null
     would be filed as a loss by rpsRowFor and drawn as one by RpsOver. */
  it("never answers null", () => {
    for (let a = 0; a <= RPS_ROUNDS; a++) {
      for (let b = 0; b + a <= RPS_ROUNDS; b++) {
        expect(rpsWinner([a, b])).not.toBeNull();
      }
    }
  });
});

/* Every throw value used above is a real RpsThrow, so the pairing tests above
   cannot silently pass on a typo'd string. */
it("RPS_THROWS carries exactly rock, paper and scissors", () => {
  const set = new Set<RpsThrow>(RPS_THROWS);
  expect(set).toEqual(new Set<RpsThrow>(["rock", "paper", "scissors"]));
});
