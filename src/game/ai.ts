import { isStone, matchesSuit, rv } from "./cards";
import { pick, type Rng } from "./rng";
import { currentWinner, leadSuit, legalCards, trickSize } from "./rules";
import type { Card, GameState, Seat, Suit } from "./types";

/* ============================ the opponents ============================
   This is heuristics, not optimal play. Randomness arrives as a parameter, so
   the functions stay pure and the run stays reproducible. */

export function handPower(g: Pick<GameState, "hands">, p: Seat): number {
  const h = g.hands[p];
  let s = 0;
  for (const c of h) s += c.r === 14 ? 3 : c.r === 13 ? 2 : c.r === 12 ? 1 : 0;
  const bySuit: Partial<Record<Suit, number>> = {};
  h.forEach((c) => (bySuit[c.s] = (bySuit[c.s] || 0) + 1));
  for (const k of Object.keys(bySuit) as Suit[]) if ((bySuit[k] ?? 0) <= 1) s += 1;
  return s;
}

export function aiDeclare(g: Pick<GameState, "hands">, p: Seat): "rami" | "nolo" {
  return handPower(g, p) >= 9 ? "rami" : "nolo";
}

type AiState = Pick<GameState, "hands" | "trick" | "sooli" | "sooliOrder" | "mode" | "boss">;

export function chooseAI(g: AiState, p: Seat, rng: Rng): Card {
  const legal = legalCards(g, p);
  if (g.boss && g.boss.id === "umpimahka" && p === 2 && !g.sooli) return pick(rng, legal);

  const low = (a: Card[]) => a.slice().sort((x, y) => rv(g, x) - rv(g, y))[0];
  const high = (a: Card[]) => a.slice().sort((x, y) => rv(g, y) - rv(g, x))[0];
  /* In rami an opponent wants tricks; in nolo they dodge them. Against a
     sooli the rami side plays low: the aim is to force the sooli player to
     take a trick. */
  const wantsTricks = g.sooli ? false : g.mode === "rami";

  if (!g.trick.length) {
    /* Leading low against a sooli is lethal, but a club player does not find
       it every time. Do not "fix" this to be optimal — without the slack a
       sooli would succeed about 4% of the time. */
    if (g.sooli) return rng.next() < 0.35 ? low(legal) : pick(rng, legal);
    if (!wantsTricks) return low(legal);
    const aces = legal.filter((c) => rv(g, c) === 14);
    if (aces.length) return aces[0];
    const bySuit: Partial<Record<Suit, Card[]>> = {};
    legal.forEach((c) => {
      if (!isStone(c)) (bySuit[c.s] = bySuit[c.s] ?? []).push(c);
    });
    const suits = Object.keys(bySuit) as Suit[];
    if (!suits.length) return legal[0];
    suits.sort((a, b) => (bySuit[b]?.length ?? 0) - (bySuit[a]?.length ?? 0));
    return (bySuit[suits[0]] ?? []).slice().sort((a, b) => rv(g, b) - rv(g, a))[0];
  }

  const w = currentWinner(g);
  if (!w) return legal[0];
  const ls = leadSuit(g);
  const partner = ((p + 2) % 4) as Seat;
  const last = g.trick.length === trickSize(g) - 1;
  const wStone = isStone(w.card);
  const canWin = legal.filter((c) => matchesSuit(c, ls) && (wStone || rv(g, c) > rv(g, w.card)));

  if (!wantsTricks) {
    /* nolo: a stone card is a guaranteed duck, otherwise stay under */
    const stones = legal.filter(isStone);
    if (stones.length) return stones[0];
    const under = legal.filter((c) => matchesSuit(c, ls) && !wStone && rv(g, c) < rv(g, w.card));
    if (under.length) return under[under.length - 1];
    if (legal.every((c) => !matchesSuit(c, ls)))
      return high(legal); /* void in the suit: throw the rubbish */
    return low(legal);
  }
  if (w.p === partner && !g.sooli && (last || rv(g, w.card) >= 13)) return low(legal);
  if (canWin.length) return low(canWin);
  return low(legal);
}

/* In sooli the ace is lowest, so the dangerous cards are 10..K. The verdict
   is a key, not a finished sentence. */
export type SooliRisk = { high: number; lowGuards: number; verdictKey: string };

export function sooliRisk(g: Pick<GameState, "hands">): SooliRisk {
  const h = g.hands[0];
  const high = h.filter((c) => c.r >= 10 && c.r <= 13).length;
  const bySuit: Partial<Record<Suit, Card[]>> = {};
  h.forEach((c) => (bySuit[c.s] = bySuit[c.s] ?? []).push(c));
  let lowGuards = 0;
  for (const k of Object.keys(bySuit) as Suit[])
    if ((bySuit[k] ?? []).some((c) => c.r === 14 || c.r <= 3)) lowGuards++;
  return {
    high,
    lowGuards,
    verdictKey: high <= 2 ? "sooli.best" : high <= 4 ? "sooli.weak" : "sooli.hopeless",
  };
}
