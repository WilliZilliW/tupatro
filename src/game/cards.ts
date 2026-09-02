import { SM, SUITS, rankLabel } from "./constants";
import { ENH } from "./content";
import type { Card, Enhancement, EnhInfo, GameState, Suit } from "./types";

export const isStone = (c: Card): boolean => c.enh === "stone";

export const isWild = (c: Card): boolean => c.enh === "wild";

/* ls === null: a stone card led the trick, so any suited card competes. */
export function matchesSuit(c: Card, ls: Suit | null): boolean {
  if (isStone(c)) return false;
  if (ls === null || ls === undefined) return true;
  return isWild(c) || c.s === ls;
}

export function enhOf(c: Card): EnhInfo | null {
  return c.enh ? ENH[c.enh] : null;
}

/* ============================ cards ============================
   uid is the individual, and it runs off a counter in the game state rather
   than a module variable — the same reason as rngState: the reducer is pure and
   StrictMode calls it twice. Mint is a short-lived cursor the reducer writes
   back. */
export type Mint = { next: () => string; seq: number };

export function makeMint(seq: number): Mint {
  const mint: Mint = {
    seq,
    next: () => "c" + ++mint.seq,
  };
  return mint;
}

export function mkCard(mint: Mint, s: Suit, r: number, enh?: Enhancement | null): Card {
  return { s, r, id: s + r, uid: mint.next(), enh: enh ?? null };
}

export function makeDeck(mint: Mint): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(mkCard(mint, s, r));
  return d;
}

/* In sooli the ace is lowest. */
export function rv(g: Pick<GameState, "sooli">, c: Card): number {
  return g.sooli && c.r === 14 ? 1 : c.r;
}

export function chipValue(g: Pick<GameState, "chipBonus" | "boss">, c: Card): number {
  if (isStone(c)) return 50 + g.chipBonus;
  let v = c.r === 14 ? 11 : c.r >= 11 ? 10 : c.r;
  if (c.enh === "bonus") v += 40;
  v += g.chipBonus;
  if (g.boss && g.boss.id === "punainen" && SM[c.s].red) v = 0;
  return Math.max(0, v);
}

export function cardName(c: Card): string {
  return rankLabel(c.r) + SM[c.s].g;
}
