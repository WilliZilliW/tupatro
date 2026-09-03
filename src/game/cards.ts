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

/* Identity for the tuppipakka swap: a side-deck card is the enhanced twin of
   an ordinary card, so what has to agree is the card type — suit and rank —
   not the uid, which is by definition different. Compared field by field
   rather than through `id`, which is presentation only. */
export function sameFace(a: Card, b: Card): boolean {
  return a.s === b.s && a.r === b.r;
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

/* The party is a property of the card *type*, not of the individual: a
   side-deck twin, a shop offer and a dealt card all resolve to the same party,
   which is why Card carries no party field.

   Keyed off the suit and the rank rather than off `id`, and typed to ask for
   no more than those two, so a card-shaped value that carries no `id` — a shop
   offer's `card` is `{ s, r, enh }` — resolves to its own party instead of
   quietly borrowing someone else's. There is deliberately no fallback: a
   default would misattribute support and print a wrong emblem.

   The return type says `undefined` rather than pretending: `createRun` fills
   all 4 × 13 keys and the deck mints nothing outside them, so a miss is
   unreachable today, but each caller decides for itself — the card prints no
   emblem, and the reducer skips the card instead of opening an "undefined"
   bucket that would hold NaN. */
export function partyOf(
  g: Pick<GameState, "partyMap">,
  c: Pick<Card, "s" | "r">,
): string | undefined {
  return g.partyMap[c.s + c.r];
}

export function cardName(c: Card): string {
  return rankLabel(c.r) + SM[c.s].g;
}
