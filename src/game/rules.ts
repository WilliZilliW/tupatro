import { isStone, matchesSuit, rv, sameFace } from "./cards";
import { teamOf } from "./constants";
import { econOf } from "./economy";
import type { Card, GameState, Seat, Suit, TrickPlay } from "./types";

/* ============================ game logic ============================
   The pure core always takes state as a parameter and never imports it. Each
   function asks for only the fields it needs, so a test can build a small
   object instead of a whole game state. */

export function trickSize(g: Pick<GameState, "sooli">): number {
  return g.sooli ? 3 : 4;
}

/* Neither source settles competing defenders. Both match modes use a house
   tie-break: humans first, then clockwise from the dealer's left within each
   group. The other modes retain their single, lowest-numbered human offer. */
export function sooliCandidates(
  g: Pick<GameState, "challenge" | "mode" | "ramTeam" | "seats" | "dealer">,
): Seat[] {
  if (g.mode !== "rami" || g.ramTeam === null) return [];
  const seats: Seat[] = [0, 1, 2, 3];
  const defenders = seats.filter((p) => teamOf(p) !== g.ramTeam);
  if (g.challenge !== "race" && g.challenge !== "tuppi")
    return defenders.filter((p) => g.seats[p] === "human").slice(0, 1);
  const order = (p: Seat) => (p - g.dealer + 3) % 4;
  return defenders.sort(
    (a, b) => Number(g.seats[a] === "ai") - Number(g.seats[b] === "ai") || order(a) - order(b),
  );
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
export function swapTargets(g: Pick<GameState, "hands">, p: Seat, src: Card): Card[] {
  return g.hands[p].filter((c) => !c.srcUid && sameFace(c, src));
}

export function canSwapIn(g: Pick<GameState, "hands">, p: Seat, src: Card): boolean {
  return swapTargets(g, p, src).length > 0;
}

/* Whether the swap phase is worth entering at all: with no match anywhere in
   hand the player would be stopped in a phase with no move to make. */
export function anySwapAvailable(g: Pick<GameState, "hands" | "economies">, p: Seat): boolean {
  const { sideDeck, usedSide } = econOf(g, p);
  return sideDeck.some((c) => !usedSide.includes(c.uid) && canSwapIn(g, p, c));
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

/* ==================== who owns the run ====================
   The roguelike shell — the money, the jokers, the tuppipakka, the banked
   score — belongs to one seat and its partner. That seat is the first human
   on the board, which in single player is seat 0. More than one human is out
   of scope: the shell would then have to be split between them. */
export function ownerSeat(g: Pick<GameState, "seats">): Seat {
  const i = g.seats.indexOf("human");
  return i < 0 ? 0 : (i as Seat);
}

export function ownerTeam(g: Pick<GameState, "seats">): 0 | 1 {
  return teamOf(ownerSeat(g));
}

/* In rami a team scores the tricks it takes; in nolo (and sooli) the ones it
   dodges. Asked about a team, never about "us": the caller says which side it
   means.

   In sooli the question is the same for either team — the sooli player is
   alone, and the deal turns on whether that one seat is kept out of every
   trick — so the sooli branch reads the seat rather than the team. */
export function scoresFor(
  g: Pick<GameState, "sooli" | "mode" | "sooliSeat">,
  team: 0 | 1,
  winnerSeat: Seat,
): boolean {
  if (g.sooli) return winnerSeat !== g.sooliSeat;
  return g.mode === "rami" ? teamOf(winnerSeat) === team : teamOf(winnerSeat) !== team;
}
