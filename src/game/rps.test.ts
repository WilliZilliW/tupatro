import { describe, expect, it } from "vitest";
import { makeMint } from "./cards";
import { RPS_HAND, RPS_ROUNDS } from "./constants";
import {
  beats,
  makeRpsDeck,
  RPS_THROWS,
  rpsCompare,
  rpsFoe,
  rpsOver,
  rpsSeats,
  rpsThrowOf,
  rpsWinner,
  sofiaBlast,
} from "./rps";
import { createRun } from "./state";
import { card as C } from "../test/factories";
import type { Card, GameState, RpsThrow, Seat, Suit } from "./types";

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
    ["two hearts of the same throw: the higher rank wins", C("H", 7), C("H", 2), 1],
    ["two hearts of the same throw, reversed", C("H", 2), C("H", 7), -1],
    ["two spades of the same throw: the higher rank wins", C("S", 14), C("S", 7), 1],
    ["two spades of the same throw, reversed", C("S", 7), C("S", 14), -1],
    ["ace over king, still just a rank tie-break", C("S", 14), C("S", 13), 1],
    ["two diamonds of the same throw: the higher rank wins", C("D", 11), C("D", 7), 1],
    ["two diamonds of the same throw, reversed", C("D", 7), C("D", 11), -1],
    ["two ordinary clubs, foil against foil: the higher rank wins", C("C", 14), C("C", 11), 1],
    ["two ordinary clubs, foil against foil, reversed", C("C", 11), C("C", 14), -1],
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
    ["Sofia loses to an ordinary heart, even a lower one", C("H", 2), SOFIA, 1],
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

  /* With one of each card in the deck, a same-throw pairing that used to tie
     is now broken by rank, so no two distinct cards can still tie a round. */
  it("never ties two distinct cards of the deck", () => {
    const deck = makeRpsDeck(makeMint(0));
    for (const a of deck) {
      for (const b of deck) {
        if (a.uid === b.uid) continue;
        expect(rpsCompare(a, b)).not.toBe(0);
      }
    }
  });

  /* The three honours (the two clubs and Sofia) are their own ranks and are
     excluded from both sweeps below — they are decided ahead of rank
     entirely, whatever rank they carry. */
  const ranks = (s: Suit) =>
    s === "C"
      ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14]
      : s === "H"
        ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14]
        : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  /* Between two *different* suits, rank never enters it: the winning throw
     wins whatever the ranks are, since rpsCompare only reads rank once both
     cards already share a throw. */
  it("gives the same answer for every rank of two different suits", () => {
    for (const sa of ["H", "S", "D", "C"] as const) {
      for (const sb of ["H", "S", "D", "C"] as const) {
        if (sa === sb) continue;
        const want = rpsCompare(C(sa, 7), C(sb, 7));
        for (const ra of ranks(sa)) {
          for (const rb of ranks(sb)) {
            expect(rpsCompare(C(sa, ra), C(sb, rb))).toBe(want);
          }
        }
      }
    }
  });

  /* Within the same suit (an ordinary same-throw pairing), the sign follows
     the ranks exactly — this is the tie-break 2026-09-25-rps-draw-higher-
     card-wins introduces. */
  it("breaks a same-suit ordinary pairing by rank, ace high", () => {
    for (const s of ["H", "S", "D", "C"] as const) {
      for (const ra of ranks(s)) {
        for (const rb of ranks(s)) {
          expect(rpsCompare(C(s, ra), C(s, rb))).toBe(Math.sign(ra - rb));
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
     including a lower-ranked heart, which the same-throw tie-break would
     otherwise hand to her. */
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

describe("sofiaBlast", () => {
  it("answers 0 when the ♥Q sits in slot 0 and loses", () => {
    expect(sofiaBlast([C("H", 12), C("S", 6)])).toBe(0);
  });

  it("answers 1 when the ♥Q sits in slot 1 and loses", () => {
    expect(sofiaBlast([C("S", 6), C("H", 12)])).toBe(1);
  });

  it("answers null when neither card is Sofia", () => {
    expect(sofiaBlast([C("S", 6), C("D", 9)])).toBeNull();
  });

  it("answers null with one slot still uncommitted", () => {
    expect(sofiaBlast([C("H", 12), null])).toBeNull();
    expect(sofiaBlast([null, C("H", 12)])).toBeNull();
  });

  it("answers null for the same-card tie fixture — she cannot meet herself in a real match", () => {
    expect(sofiaBlast([C("S", 6), C("S", 6)])).toBeNull();
  });

  it("answers 0 even against the ♣K — she loses to every card, honours included", () => {
    expect(sofiaBlast([C("H", 12), C("C", 13)])).toBe(0);
  });
});

/* Every throw value used above is a real RpsThrow, so the pairing tests above
   cannot silently pass on a typo'd string. */
it("RPS_THROWS carries exactly rock, paper, scissors and foil", () => {
  const set = new Set<RpsThrow>(RPS_THROWS);
  expect(set).toEqual(new Set<RpsThrow>(["rock", "paper", "scissors", "foil"]));
});

describe("rpsSeats", () => {
  const withSeats = (seats: GameState["seats"]): GameState => ({ ...createRun("SEATS"), seats });

  it("answers [p, p+1] for a single human at each of the four seats", () => {
    for (const p of [0, 1, 2, 3] as const) {
      const seats = ["ai", "ai", "ai", "ai"] as GameState["seats"];
      seats[p] = "human";
      const g = withSeats(seats);
      expect(rpsSeats(g)).toEqual([p, ((p + 1) % 4) as Seat]);
    }
  });

  it("answers [0, 1] for an all-AI board — the same fallback a single human gets", () => {
    const g = withSeats(["ai", "ai", "ai", "ai"]);
    expect(rpsSeats(g)).toEqual([0, 1]);
  });

  it("answers [0, 1] for humans at chairs 0 and 1, on different teams", () => {
    const g = withSeats(["human", "human", "ai", "ai"]);
    expect(rpsSeats(g)).toEqual([0, 1]);
  });

  it("answers [0, 3] for humans at chairs 3 and 0 — ownerSeat is the lower index", () => {
    const g = withSeats(["human", "ai", "ai", "human"]);
    expect(rpsSeats(g)).toEqual([0, 3]);
  });

  /* Chairs 0 and 2 are partners (teamOf(p) = p % 2), and rpsCards/rpsWins are
     team-indexed, so two humans on the same team could never both commit —
     the fallback answers exactly what a single human at chair 0 would get,
     a soft failure rather than a stall (see rps.ts's own comment). */
  it("falls back to [0, 1] for humans at chairs 0 and 2 — the same team", () => {
    const g = withSeats(["human", "ai", "human", "ai"]);
    expect(rpsSeats(g)).toEqual([0, 1]);
  });

  it("rpsFoe(g) is rpsSeats(g)'s second element", () => {
    const g = withSeats(["human", "ai", "ai", "human"]);
    expect(rpsFoe(g)).toBe(rpsSeats(g)[1]);
  });

  it("consumes no randomness — reads g.seats alone", () => {
    const g = withSeats(["human", "human", "ai", "ai"]);
    const before = g.rngState;
    rpsSeats(g);
    expect(g.rngState).toBe(before);
  });
});
