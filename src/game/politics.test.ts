/* Politiikka's own rule: the rotation and the Sofia card. Pure, no reducer
   involved. */
import { describe, expect, it } from "vitest";
import { isSofia, makeDeck, makeMint } from "./cards";
import { politicsMode, sofiaIn } from "./politics";

describe("politicsMode", () => {
  it("alternates rami and nolo, starting on rami for deal 1", () => {
    const got = Array.from({ length: 10 }, (_, i) => politicsMode(i + 1));
    expect(got).toEqual([
      "rami",
      "nolo",
      "rami",
      "nolo",
      "rami",
      "nolo",
      "rami",
      "nolo",
      "rami",
      "nolo",
    ]);
  });
});

describe("sofiaIn", () => {
  it("finds the ♥Q's play in a trick", () => {
    const deck = makeDeck(makeMint(0));
    const sofia = deck.find(isSofia)!;
    const other = deck.find((c) => !isSofia(c))!;
    const trick = [
      { p: 0 as const, card: other },
      { p: 1 as const, card: sofia },
    ];
    const play = sofiaIn(trick);
    expect(play?.card.uid).toBe(sofia.uid);
    expect(play?.p).toBe(1);
  });

  it("returns null when she is not in the trick", () => {
    const deck = makeDeck(makeMint(0));
    const trick = deck.filter((c) => !isSofia(c)).slice(0, 3);
    expect(sofiaIn(trick.map((card, p) => ({ p: p as 0 | 1 | 2, card })))).toBeNull();
  });

  /* Exactly one card in the whole deck answers isSofia: the ♥Q, and no other
     rank or suit. */
  it("exactly one card in makeDeck() answers isSofia", () => {
    const deck = makeDeck(makeMint(0));
    const sofias = deck.filter(isSofia);
    expect(sofias).toHaveLength(1);
    expect(sofias[0].s).toBe("H");
    expect(sofias[0].r).toBe(12);
  });
});
