import { isStone, matchesSuit, rv, sameFace } from "./cards";
import { isUs } from "./constants";
import type { Card, GameState, Seat, Suit, TrickPlay } from "./types";

/* ============================ game logic ============================
   The pure core always takes state as a parameter and never imports it. Each
   function asks for only the fields it needs, so a test can build a small
   object instead of a whole game state. */

export function trickSize(g: Pick<GameState, "sooli">): number {
  return g.sooli ? 3 : 4;
}

export function nextSeat(g: Pick<GameState, "sooli" | "sooliOrder">, p: Seat): Seat {
  if (!g.sooli || !g.sooliOrder) return ((p + 1) % 4) as Seat;
  const i = g.sooliOrder.indexOf(p);
  return g.sooliOrder[(i + 1) % 3];
}

/* The led suit = the first suited card's suit (a stone card leads no suit). */
export function leadSuit(g: { trick: TrickPlay[] }): Suit | null {
  for (const t of g.trick) if (!isStone(t.card)) return t.card.s;
  return null;
}

/* maantuntopakko (the follow-suit obligation) — a stone card is always
   playable, and a wild card counts as following */
export function legalCards(g: Pick<GameState, "hands" | "trick">, p: Seat): Card[] {
  const h = g.hands[p];
  const ls = leadSuit(g);
  if (ls === null) return h.slice();
  const follow = h.filter((c) => matchesSuit(c, ls));
  if (!follow.length) return h.slice();
  return follow.concat(h.filter(isStone));
}

/* ==================== the tuppipakka swap ====================
   A side-deck card replaces its own twin and nothing else: same suit, same
   rank. The swap upgrades a card you were dealt rather than changing which
   cards you hold, so the tuppipakka is a set of bets on the deal — the card
   has to turn up before its enhancement is worth anything.

   A card already swapped in is not a target either. It carries srcUid, and
   trading it away would burn a second swap to end up with fewer
   enhancements. */
export function swapTargets(g: Pick<GameState, "hands">, src: Card): Card[] {
  return g.hands[0].filter((c) => !c.srcUid && sameFace(c, src));
}

export function canSwapIn(g: Pick<GameState, "hands">, src: Card): boolean {
  return swapTargets(g, src).length > 0;
}

/* Whether the swap phase is worth entering at all: with no match anywhere in
   hand the player would be stopped in a phase with no move to make. */
export function anySwapAvailable(g: Pick<GameState, "hands" | "sideDeck" | "usedSide">): boolean {
  return g.sideDeck.some((c) => !g.usedSide.includes(c.uid) && canSwapIn(g, c));
}

/* No trump: the trick goes to the highest card of the led suit. A stone card
   never wins, and a tie goes to the card played earlier (the comparison is
   strictly greater — do not change it to >=). */
export function currentWinner(g: Pick<GameState, "trick" | "sooli">): TrickPlay | null {
  if (!g.trick.length) return null;
  const ls = leadSuit(g);
  let best: TrickPlay | null = null;
  for (const t of g.trick) {
    if (!matchesSuit(t.card, ls)) continue;
    if (!best || rv(g, t.card) > rv(g, best.card)) best = t;
  }
  return best ?? g.trick[0];
}

/* In rami you score the tricks you take; in nolo (and sooli) the ones you
   dodge. */
export function scoresForUs(g: Pick<GameState, "sooli" | "mode">, winnerSeat: Seat): boolean {
  if (g.sooli) return winnerSeat !== 0;
  return g.mode === "rami" ? isUs(winnerSeat) : !isUs(winnerSeat);
}
