/* Both point tables, pinned against the issue's own numbers; the whole deck's
   sum for each; and the sum = 4 identity an arbitrary split of the deck rests
   on — the match's own termination proof. */
import { describe, expect, it } from "vitest";
import { makeMint, makeDeck } from "./cards";
import { NAMI_VARIANT, namiTrick, namiValue } from "./nami";

/* Every rank the issue names, both tables, quoted verbatim in the spec. */
describe("namiValue", () => {
  it.each([
    [14, 4, -1], // A
    [13, 3, 13], // K
    [12, 2, 12], // Q
    [11, 1, 11], // J
    [10, -1, 10],
    [9, -1, -9],
    [8, -1, -8],
    [7, -1, -7],
    [6, -1, -6],
    [5, -1, -5],
    [4, -1, -4],
    [3, -1, -3],
    [2, -1, -2],
  ])("scores rank %d as %d easy and %d hard", (r, easy, hard) => {
    expect(namiValue("easy", { r })).toBe(easy);
    expect(namiValue("hard", { r })).toBe(hard);
  });

  it("maps the two challenge ids to their own variant", () => {
    expect(NAMI_VARIANT.nami).toBe("easy");
    expect(NAMI_VARIANT.namihard).toBe("hard");
  });
});

describe("the whole deck sums to a fixed total in both variants", () => {
  const deck = makeDeck(makeMint(0));

  it("easy: 4 x (4+3+2+1) = 40, and 36 x -1 = -36, net +4", () => {
    const courts = deck.filter((c) => c.r >= 11);
    const rest = deck.filter((c) => c.r < 11);
    expect(courts).toHaveLength(16);
    expect(rest).toHaveLength(36);
    expect(namiTrick("easy", courts)).toBe(40);
    expect(namiTrick("easy", rest)).toBe(-36);
    expect(namiTrick("easy", deck)).toBe(4);
  });

  /* The "minus" side is the ace *and* 2-9 — the ace's hard value is -1, the
     same shape as the rest of the avoid-these table — and the "plus" side is
     10-K. Per suit: -(1+2+...+9) = -45 and 10+11+12+13 = +46, so +1 a suit
     and +4 over the whole deck. */
  it("hard: -(1+2+...+9) x 4 = -180, and (10+11+12+13) x 4 = 184, net +4", () => {
    const minus = deck.filter((c) => c.r === 14 || (c.r >= 2 && c.r <= 9));
    const plus = deck.filter((c) => c.r >= 10 && c.r <= 13);
    expect(minus).toHaveLength(36);
    expect(plus).toHaveLength(16);
    expect(namiTrick("hard", minus)).toBe(-180);
    expect(namiTrick("hard", plus)).toBe(184);
    expect(namiTrick("hard", deck)).toBe(4);
  });
});

/* The identity the match's termination rests on: split the deck any way
   between two pairs and the two totals still sum to 4 — the whole deck is
   captured in the thirteen tricks of every Nami deal, with no sooli to take a
   hand out of play and no trick of three. */
describe("an arbitrary split of the deck sums to exactly 4", () => {
  const deck = makeDeck(makeMint(0));

  it.each(["easy", "hard"] as const)("%s: every split of the 52 cards nets 4", (v) => {
    for (const cut of [0, 1, 13, 26, 39, 51, 52]) {
      const a = deck.slice(0, cut);
      const b = deck.slice(cut);
      expect(namiTrick(v, a) + namiTrick(v, b)).toBe(4);
    }
  });

  it("holds for an uneven, non-contiguous split too", () => {
    const a = deck.filter((_, i) => i % 3 === 0);
    const b = deck.filter((_, i) => i % 3 !== 0);
    expect(namiTrick("easy", a) + namiTrick("easy", b)).toBe(4);
    expect(namiTrick("hard", a) + namiTrick("hard", b)).toBe(4);
  });
});
