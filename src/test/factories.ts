import { makeDeck, makeMint, mkCard } from "../game/cards";
import { createRun } from "../game/state";
import type { Card, Enhancement, GameState, Suit } from "../game/types";

/* Test helpers. Cards come from a single mint, so uids stay unique even when
   the same card type is created twice. */
const mint = makeMint(0);

export const card = (s: Suit, r: number, enh?: Enhancement): Card => mkCard(mint, s, r, enh);

export const freshDeck = (): Card[] => makeDeck(makeMint(0));

/* A full game state, over which a test writes only the fields it cares about.
   The pure functions read only what they need, but a full object keeps the
   types strict and spares the test from tracking Pick signatures. */
export function st(over: Partial<GameState> = {}): GameState {
  return { ...createRun("TEST"), mode: "rami", ramTeam: 0, ...over };
}
