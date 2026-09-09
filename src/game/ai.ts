import { isStone, matchesSuit, rv } from "./cards";
import { comboOk, isRun, isSet, pipTotal } from "./laydown";
import { pick, type Rng } from "./rng";
import { partnerOf } from "./constants";
import { currentWinner, leadSuit, legalCards, ownerSeat, trickSize } from "./rules";
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

type AiState = Pick<
  GameState,
  "hands" | "trick" | "sooli" | "sooliOrder" | "mode" | "boss" | "seats"
>;

export function chooseAI(g: AiState, p: Seat, rng: Rng): Card {
  const legal = legalCards(g, p);
  /* Umpimahka blinds the run owner's partner — the one seat whose play the
     owner would otherwise be able to count on. */
  if (g.boss && g.boss.id === "umpimahka" && p === partnerOf(ownerSeat(g)) && !g.sooli)
    return pick(rng, legal);

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
  const partner = partnerOf(p);
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

export function sooliRisk(g: Pick<GameState, "hands">, p: Seat): SooliRisk {
  const h = g.hands[p];
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

/* Conservative acceptance policy, not optimal play: at most one
   10..K and an A/2/3 in every occupied suit. Only this seat's hand is read;
  neither the decision nor the discard consumes randomness. Measured outcomes
  are in the README; conservative entry does not guarantee a successful sooli. */
export function shouldSooli(g: Pick<GameState, "hands">, p: Seat): boolean {
  const hand = g.hands[p];
  if (!hand.length) return false;
  const risk = sooliRisk(g, p);
  return risk.high <= 1 && risk.lowGuards === new Set(hand.map((c) => c.s)).size;
}

export function chooseSooliGive(g: Pick<GameState, "hands">, p: Seat): Card | null {
  return g.hands[p].reduce<Card | null>(
    (best, c) => (!best || rv({ sooli: true }, c) > rv({ sooli: true }, best) ? c : best),
    null,
  );
}

/* ==================== the laydown ====================
   Deliberately the simple subset of the Rummikub search: extend each row on
   the table by one card, then lay whatever fresh sets and runs the rest of the
   hand affords, dearest first. It never splits a combination and never merges
   two, so it is a weaker opponent than a thinking player — not a different
   rule set. Whatever it proposes goes through the same validateLay the player
   does, and the reducer passes for it rather than throwing if it is rejected.

   Returns the whole proposed table as rows of uids, or null to pass. */
export function chooseLaydown(
  g: Pick<GameState, "table" | "layHands">,
  side: 0 | 1,
): string[][] | null {
  const rows = g.table.map((r) => r.slice());
  const pool = g.layHands[side].slice();
  const take = (c: Card) =>
    pool.splice(
      pool.findIndex((x) => x.uid === c.uid),
      1,
    );
  let laid = 0;

  /* One card per row, the dearest that fits: isRun sorts, so a row extends at
     either end without the caller knowing which. */
  for (const row of rows) {
    const cand = pool
      .slice()
      .sort((a, b) => b.r - a.r)
      .find((c) => comboOk([...row, c]));
    if (!cand) continue;
    row.push(cand);
    take(cand);
    laid++;
  }

  for (let guard = 0; guard < 18; guard++) {
    const best = bestCombo(pool);
    if (!best) break;
    rows.push(best);
    for (const c of best) take(c);
    laid++;
  }

  if (!laid) return null;
  return rows.map((r) => r.map((c) => c.uid));
}

/* The dearest legal combination the pool affords: every rank with three or
   more cards is a set, and every maximal consecutive stretch of a suit is a
   run. Greedy by pip total, which is what the turn actually scores. */
function bestCombo(pool: Card[]): Card[] | null {
  const cands: Card[][] = [];

  const byRank = new Map<number, Card[]>();
  for (const c of pool) byRank.set(c.r, [...(byRank.get(c.r) ?? []), c]);
  for (const group of byRank.values()) if (isSet(group)) cands.push(group);

  const bySuit = new Map<Suit, Card[]>();
  for (const c of pool) bySuit.set(c.s, [...(bySuit.get(c.s) ?? []), c]);
  for (const group of bySuit.values()) {
    const sorted = group.slice().sort((a, b) => a.r - b.r);
    let run: Card[] = [];
    for (const c of sorted) {
      if (run.length && c.r - run[run.length - 1].r !== 1) {
        if (isRun(run)) cands.push(run);
        run = [];
      }
      run.push(c);
    }
    if (isRun(run)) cands.push(run);
  }

  if (!cands.length) return null;
  return cands.sort((a, b) => pipTotal(b) - pipTotal(a))[0];
}
