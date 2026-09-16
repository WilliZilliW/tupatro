import type { Card } from "./types";

/* ==================== Nami's point table ====================
   The custom mode's whole arithmetic, and nothing else: no wallet, no boss, no
   `base`, no `GameState`. A Nami deal's worth is the *contents* of the tricks a
   pair captured, not their count, so this module reads a card's rank alone —
   the same reason `pipValue` (the laydown's rank count) takes nothing but a
   card. Three different questions live in three different functions on
   purpose: `chipValue` is what a card is worth to score with jokers and a
   tuppi multiplier, `pipValue` is a laydown's rank count, and `namiValue` is
   this mode's own signed point. Aliasing any two of them would silently
   rescore a mode that has nothing to do with the one it borrowed from.

   Quoted verbatim from GitHub issue #7, the mode's only source (a web search
   for a published card game called "Nami" found none):

     "Helpot säännöt: Pistekortit: A = +4, K = +3, Q = +2, J = +1. Kaikki muut
     (2–10, myös kymppi): −1 kukin."

     "Vaikeat säännöt: Miinus (vältä): A = −1, 2 = −2, 3 = −3, … 9 = −9. Plus
     (kerää): 10 = +10, J = +11, Q = +12, K = +13."

   "Kaikki muut (2–10, myös kymppi)" is every rank the easy table's point list
   does not name, so exactly 2–10 are −1 each there — the issue spells the ten
   out because it is the trap a player would otherwise reach for as a face
   card. The hard table's "A = −1" is a *value*, not a rank order: the ace
   still takes the trick in both variants, because the trick play this mode
   keeps is ordinary tuppi's, where the ace is high. There is no sooli here to
   turn that round. */

export type NamiVariant = "easy" | "hard";

/* Both tables sum to exactly +4 over the whole deck — the match's own
   termination proof, spelled out in nami.test.ts and the spec. */
const EASY: Record<number, number> = {
  14: 4, // A
  13: 3, // K
  12: 2, // Q
  11: 1, // J
  10: -1,
  9: -1,
  8: -1,
  7: -1,
  6: -1,
  5: -1,
  4: -1,
  3: -1,
  2: -1,
};

const HARD: Record<number, number> = {
  14: -1, // A
  13: 13, // K
  12: 12, // Q
  11: 11, // J
  10: 10,
  9: -9,
  8: -8,
  7: -7,
  6: -6,
  5: -5,
  4: -4,
  3: -3,
  2: -2,
};

export function namiValue(v: NamiVariant, card: Pick<Card, "r">): number {
  const table = v === "easy" ? EASY : HARD;
  return table[card.r] ?? 0;
}

export function namiTrick(v: NamiVariant, cards: Array<Pick<Card, "r">>): number {
  return cards.reduce((sum, c) => sum + namiValue(v, c), 0);
}

/* The two Nami challenge ids, and which table each plays. Kept here rather
   than tested inline at every call site, the same shape CHALLENGES itself
   uses for a row's own data. */
export const NAMI_VARIANT: Record<"nami" | "namihard", NamiVariant> = {
  nami: "easy",
  namihard: "hard",
};
