import { describe, expect, it } from "vitest";

import { card, st } from "../test/factories";
import { HAND_SUITS, SM, SUITS } from "./constants";
import { applySort, bySuitThenRank, sortHand } from "./state";
import type { Card, Suit } from "./types";

/* A hand's layout order, which is a display question and not an engine one.
   The two orders are separate constants and these tests hold both halves of
   that: the layout alternates colour, and the engine's order does not move. */

const suitsOf = (hand: Card[]): Suit[] => [...new Set(hand.map((c) => c.s))];

describe("HAND_SUITS", () => {
  it("alternates colour, so no two same-coloured suits sit side by side", () => {
    const reds = HAND_SUITS.map((s) => SM[s].red);
    expect(reds).toEqual([false, true, false, true]);
  });

  it("holds each of the four suits exactly once", () => {
    expect([...HAND_SUITS].sort()).toEqual([...SUITS].sort());
  });

  /* The engine's order builds the deck, rolls the shop's card offer and rolls
     the party map. Reordering it reshuffles every existing seed, so it is
     pinned here rather than left to seats.test.ts's golden — which would move
     wholesale and say nothing about why. */
  it("leaves the engine's own suit order alone", () => {
    expect(SUITS).toEqual(["S", "H", "D", "C"]);
  });
});

/* A hand holding one card of every suit, dealt in the engine's order, so a
   sort that quietly used SUITS would leave it untouched and pass. */
const oneEach = (): Card[] => SUITS.map((s, i) => card(s, 5 + i));

/* sortHand is the hands nobody looks at, and it deliberately keeps the
   engine's order: an AI reads its hand in order and breaks a tie by taking the
   first candidate, so the layout order laid over an opponent's hand would let
   a display choice change how the opponent plays. */
describe("sortHand", () => {
  it("keeps the engine's suit order for an AI hand nobody sees", () => {
    const g = st({ hands: [[], oneEach(), [], []], seats: ["human", "ai", "ai", "ai"] });
    sortHand(g, 1);
    expect(suitsOf(g.hands[1])).toEqual([...SUITS]);
  });

  /* A hot-seat race draws the window for whichever human is to play, and
     `sooliGive` re-sorts a partner `applySort` never reaches. */
  it("lays a human seat out in the layout order", () => {
    const g = st({ hands: [[], oneEach(), [], []], seats: ["human", "human", "ai", "ai"] });
    sortHand(g, 1);
    expect(suitsOf(g.hands[1])).toEqual([...HAND_SUITS]);
  });

  it("orders the ranks within a suit from high to low", () => {
    const g = st({ hands: [[card("H", 7), card("H", 14), card("H", 2)], [], [], []] });
    sortHand(g, 0);
    expect(g.hands[0].map((c) => c.r)).toEqual([14, 7, 2]);
  });
});

describe("applySort", () => {
  it("groups by the layout order in suit mode", () => {
    const g = st({ hands: [oneEach(), [], [], []], sortMode: "suit", customOrder: false });
    applySort(g, 0);
    expect(suitsOf(g.hands[0])).toEqual([...HAND_SUITS]);
  });

  /* Rank mode still breaks a tie by suit, and that tie-break is the layout
     order too — four fives would otherwise read ♠ ♥ ♦ ♣. */
  it("breaks a rank tie by the layout order", () => {
    const g = st({
      hands: [SUITS.map((s) => card(s, 5)), [], [], []],
      sortMode: "rank",
      customOrder: false,
    });
    applySort(g, 0);
    expect(g.hands[0].map((c) => c.s)).toEqual([...HAND_SUITS]);
  });

  it("leaves a hand the player has dragged alone", () => {
    const hand = oneEach();
    const before = hand.map((c) => c.uid);
    const g = st({ hands: [hand, [], [], []], sortMode: "suit", customOrder: true });
    applySort(g, 0);
    expect(g.hands[0].map((c) => c.uid)).toEqual(before);
  });
});

/* The laydown's two hands have no seat index, so they sort through the
   exported comparator rather than sortHand — and must read the same way. */
describe("bySuitThenRank", () => {
  it("lays the suits out in the layout order", () => {
    expect(suitsOf(oneEach().sort(bySuitThenRank))).toEqual([...HAND_SUITS]);
  });
});
