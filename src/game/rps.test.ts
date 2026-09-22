import { describe, expect, it } from "vitest";
import { makeMint } from "./cards";
import { RPS_HAND, RPS_ROUNDS } from "./constants";
import { beats, makeRpsDeck, RPS_THROWS, rpsCompare, rpsOver, rpsThrowOf, rpsWinner } from "./rps";
import { card as C } from "../test/factories";
import type { Card, RpsThrow, Suit } from "./types";

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

  it("pins aluminium foil: it wraps rock and paper, and only scissors cut it", () => {
    expect(beats("foil", "rock")).toBe(true);
    expect(beats("foil", "paper")).toBe(true);
    expect(beats("scissors", "foil")).toBe(true);
    expect(beats("foil", "scissors")).toBe(false);
    expect(beats("rock", "foil")).toBe(false);
    expect(beats("paper", "foil")).toBe(false);
    expect(beats("foil", "foil")).toBe(false);
  });

  /* Four throws cannot be equally strong — six pairings over four throws is
     1.5 wins each — so the counts are pinned rather than asserted equal: the
     table is asymmetric on purpose, and this is what stops it drifting into
     a dominant throw (one that beats all three) or a dead one (beats none). */
  it("decides every pairing of different throws, and no throw dominates or dies", () => {
    expect(RPS_THROWS).toHaveLength(4);
    const wins: Record<string, number> = {};
    for (const a of RPS_THROWS) {
      wins[a] = RPS_THROWS.filter((b) => beats(a, b)).length;
      for (const b of RPS_THROWS) {
        /* Antisymmetric, and only a throw against itself is undecided. */
        if (a === b) expect(beats(a, b)).toBe(false);
        else expect(beats(a, b)).not.toBe(beats(b, a));
      }
    }
    expect(wins).toEqual({ rock: 1, paper: 1, scissors: 2, foil: 2 });
  });
});

describe("makeRpsDeck", () => {
  const deck = makeRpsDeck(makeMint(0));
  const of = (s: Suit) => deck.filter((c) => c.s === s);

  it("is the ordinary 52, because all four suits are throws now", () => {
    expect(deck).toHaveLength(52);
  });

  it("holds every rank of every suit, clubs included", () => {
    for (const s of ["H", "S", "D", "C"] as const) {
      expect(of(s)).toHaveLength(13);
      expect(
        of(s)
          .map((c) => c.r)
          .sort((a, b) => a - b),
      ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    }
  });

  it("mints a distinct uid for every card and enhances none of them", () => {
    expect(new Set(deck.map((c) => c.uid)).size).toBe(52);
    expect(deck.every((c) => c.enh === null)).toBe(true);
  });

  it("takes the reducer's own Mint rather than making one", () => {
    const mint = makeMint(7);
    makeRpsDeck(mint);
    expect(mint.seq).toBe(7 + 52);
  });
});

describe("rpsThrowOf", () => {
  it("maps each suit onto its own throw, clubs onto foil", () => {
    expect(rpsThrowOf(C("H", 5))).toBe("paper");
    expect(rpsThrowOf(C("S", 5))).toBe("rock");
    expect(rpsThrowOf(C("D", 5))).toBe("scissors");
    expect(rpsThrowOf(C("C", 5))).toBe("foil");
    expect(rpsThrowOf(C("C", 14))).toBe("foil");
  });

  /* The two club honours and Sofia are cards without a throw: all three are
     decided ahead of the throw table, so a caller that read them as a throw
     would let scissors cut the king, or let an ordinary heart tie hers. */
  it("answers null for the two club honours and Sofia, and for nothing else", () => {
    expect(rpsThrowOf(C("C", 13))).toBeNull();
    expect(rpsThrowOf(C("C", 12))).toBeNull();
    expect(rpsThrowOf(C("H", 12))).toBeNull();
    const deck = makeRpsDeck(makeMint(0));
    expect(
      deck
        .filter((c) => rpsThrowOf(c) === null)
        .map((c) => c.id)
        .sort(),
    ).toEqual(["C12", "C13", "H12"]);
  });
});

describe("rpsCompare", () => {
  /* The five classes the table is over: the three suits and the two clubs.
     A rank is named only so the fixture is a real card — the next case
     proves the rank cannot matter. */
  const H = C("H", 7);
  const S = C("S", 7);
  const D = C("D", 7);
  const K = C("C", 13);
  const Q = C("C", 12);
  const SOFIA = C("H", 12);

  const F = C("C", 7);

  const cases: Array<[string, Card, Card, 1 | 0 | -1]> = [
    ["spades take diamonds (rock blunts scissors)", S, D, 1],
    ["diamonds take hearts (scissors cut paper)", D, H, 1],
    ["hearts take spades (paper covers rock)", H, S, 1],
    ["diamonds under spades", D, S, -1],
    ["hearts under diamonds", H, D, -1],
    ["spades under hearts", S, H, -1],
    ["two hearts tie", H, C("H", 2), 0],
    ["two spades tie", S, C("S", 14), 0],
    ["two diamonds tie", D, C("D", 11), 0],
    ["two ordinary clubs tie, foil against foil", F, C("C", 4), 0],
    ["foil wraps rock", F, S, 1],
    ["foil wraps paper", F, H, 1],
    ["scissors cut foil", D, F, 1],
    ["rock under foil", S, F, -1],
    ["paper under foil", H, F, -1],
    ["foil under scissors", F, D, -1],
    ["the king of clubs takes hearts", K, H, 1],
    ["the king of clubs takes spades", K, S, 1],
    ["the king of clubs takes diamonds", K, D, 1],
    ["the king of clubs takes an ordinary club", K, F, 1],
    ["the king of clubs takes the queen of clubs", K, Q, 1],
    ["hearts under the king of clubs", H, K, -1],
    ["the queen of clubs takes hearts", Q, H, 1],
    ["the queen of clubs takes spades", Q, S, 1],
    ["the queen of clubs takes diamonds", Q, D, 1],
    ["the queen of clubs takes an ordinary club", Q, F, 1],
    ["the queen of clubs under the king of clubs", Q, K, -1],
    ["Sofia loses to an ordinary heart, unlike two hearts tying", H, SOFIA, 1],
    ["Sofia under an ordinary heart", SOFIA, H, -1],
    ["Sofia loses to spades", SOFIA, S, -1],
    ["spades take Sofia", S, SOFIA, 1],
    ["Sofia loses to diamonds", SOFIA, D, -1],
    ["Sofia loses to an ordinary club", SOFIA, F, -1],
    ["Sofia loses to the king of clubs", SOFIA, K, -1],
    ["the king of clubs takes Sofia", K, SOFIA, 1],
    ["Sofia loses to the queen of clubs", SOFIA, Q, -1],
    ["the queen of clubs takes Sofia", Q, SOFIA, 1],
    ["Sofia against herself is the one tie she has", SOFIA, SOFIA, 0],
  ];

  it.each(cases)("%s", (_label, a, b, want) => {
    expect(rpsCompare(a, b)).toBe(want);
  });

  /* Summed rather than negated: Object.is separates 0 from -0, so a tie
     compared against -rpsCompare(b, a) fails on the sign of nothing. */
  it("is antisymmetric over every ordered pair of the deck", () => {
    const deck = makeRpsDeck(makeMint(0));
    for (const a of deck) {
      for (const b of deck) {
        expect(rpsCompare(a, b) + rpsCompare(b, a)).toBe(0);
      }
    }
  });

  /* Rank decides nothing: replacing either card's rank with any other rank of
     the same suit leaves the answer alone, so no high-card tie-break can
     creep in. The three honours (the two clubs and Sofia) are their own
     ranks and are excluded — they are the only place in the mode where a
     rank means anything. */
  const ranks = (s: Suit) =>
    s === "C"
      ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14]
      : s === "H"
        ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14]
        : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  it("gives the same answer for every rank of the same two suits", () => {
    for (const sa of ["H", "S", "D", "C"] as const) {
      for (const sb of ["H", "S", "D", "C"] as const) {
        const want = rpsCompare(C(sa, 7), C(sb, 7));
        for (const ra of ranks(sa)) {
          for (const rb of ranks(sb)) {
            expect(rpsCompare(C(sa, ra), C(sb, rb))).toBe(want);
          }
        }
      }
    }
  });

  /* Each club honour against every other card in the deck, both ways round:
     its answer is its own and never the other card's suit or rank. */
  it("keeps both club honours' answers whatever they meet", () => {
    for (const s of ["H", "S", "D", "C"] as const) {
      for (const r of ranks(s)) {
        expect(rpsCompare(C("C", 13), C(s, r))).toBe(1);
        expect(rpsCompare(C(s, r), C("C", 13))).toBe(-1);
        expect(rpsCompare(C("C", 12), C(s, r))).toBe(1);
        expect(rpsCompare(C(s, r), C("C", 12))).toBe(-1);
      }
    }
  });

  /* Sofia is the mirror of the two club honours: she loses to every other
     card in the deck rather than beating it, whatever its suit or rank —
     including an ordinary heart, which would otherwise tie her. */
  it("loses Sofia's answer to whatever she meets, except herself", () => {
    for (const s of ["H", "S", "D", "C"] as const) {
      for (const r of ranks(s)) {
        expect(rpsCompare(C("H", 12), C(s, r))).toBe(-1);
        expect(rpsCompare(C(s, r), C("H", 12))).toBe(1);
      }
    }
  });
});

describe("rpsOver / rpsWinner", () => {
  it("ends only once RPS_ROUNDS rounds have been played", () => {
    expect(RPS_ROUNDS).toBe(12);
    /* One round per card dealt, so the hand and the match end together. */
    expect(RPS_HAND).toBe(RPS_ROUNDS);
    for (let n = 0; n < RPS_ROUNDS; n++) expect(rpsOver(n)).toBe(false);
    expect(rpsOver(RPS_ROUNDS)).toBe(true);
  });

  /* A match plays all twelve rounds and a tie counts for neither side, so
     the wins need not sum to twelve — and equal wins is a draw, a real
     outcome rather than "not decided yet". */
  const cases: Array<{ wins: [number, number]; winner: 0 | 1 | "draw" }> = [
    { wins: [12, 0], winner: 0 },
    { wins: [0, 12], winner: 1 },
    { wins: [7, 5], winner: 0 },
    { wins: [5, 7], winner: 1 },
    { wins: [2, 0], winner: 0 },
    { wins: [0, 2], winner: 1 },
    { wins: [6, 6], winner: "draw" },
    { wins: [0, 0], winner: "draw" },
  ];

  it.each(cases)("wins %j", ({ wins, winner }) => {
    expect(rpsWinner(wins)).toBe(winner);
  });
});

/* Every throw value used above is a real RpsThrow, so the pairing tests above
   cannot silently pass on a typo'd string. */
it("RPS_THROWS carries exactly rock, paper, scissors and foil", () => {
  const set = new Set<RpsThrow>(RPS_THROWS);
  expect(set).toEqual(new Set<RpsThrow>(["rock", "paper", "scissors", "foil"]));
});
