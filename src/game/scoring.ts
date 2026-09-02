import { chipValue, isStone, isWild } from "./cards";
import { TYPES } from "./constants";
import type { Card, GameState, ScoreContext, Seat, TrickType } from "./types";

/* ============================ pisteytys ============================ */

export function evalTrick(cards: Card[]): TrickType {
  /* A stone card has no rank and no suit, so it takes no part in the trick
     type. */
  const live = cards.filter((c) => !isStone(c));
  if (live.length < 2) return TYPES.high;
  const ranks = live.map((c) => c.r).sort((a, b) => a - b);
  const flush = new Set(live.filter((c) => !isWild(c)).map((c) => c.s)).size <= 1;
  const counts: Record<number, number> = {};
  ranks.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  const cv = Object.values(counts).sort((a, b) => b - a);
  const uniq = Array.from(new Set(ranks));
  const straight =
    uniq.length === live.length && uniq[uniq.length - 1] - uniq[0] === live.length - 1;
  if (flush && straight) return TYPES.sf;
  if (cv[0] === 4) return TYPES.quad;
  if (cv[0] === 3) return TYPES.trips;
  if (flush) return TYPES.flush;
  if (straight) return TYPES.straight;
  if (cv[0] === 2 && cv[1] === 2) return TYPES.twopair;
  if (cv[0] === 2) return TYPES.pair;
  return TYPES.high;
}

/* What the deal still needs. Returns a key and its variables rather than a
   finished sentence: the pure core knows no languages, and the component
   translates this. */
export type NeedInfo = { key: string; vars?: Record<string, number> };

export type TuppiInfo = { mult: number; need: NeedInfo; ok: boolean };

type TuppiState = Pick<
  GameState,
  "usTricks" | "jokers" | "tuppiBonus" | "boss" | "sooli" | "sooliBust" | "mode" | "ramTeam"
>;

/* The tuppi multiplier. In rami it starts at the 7th trick (4 points a trick
   -> ×1, ×2, ×3…), in nolo it counts down from six, and a ryosto doubles it. */
export function tuppiInfo(g: TuppiState): TuppiInfo {
  const won = g.usTricks;
  const bonus = g.jokers.reduce((a, j) => a + (j.tuppi || 0), 0) + g.tuppiBonus;
  const kitsas = g.boss && g.boss.id === "kitsas" ? 1 : 0;
  const fin = (m: number) => Math.max(1, m + bonus - kitsas);

  if (g.sooli) {
    if (g.sooliBust) return { mult: 0, need: { key: "need.sooliBust" }, ok: false };
    return { mult: fin(6), need: { key: "need.sooli", vars: { won } }, ok: won === 0 };
  }
  if (g.mode === "rami") {
    if (won < 7) return { mult: 0, need: { key: "need.ramiShort", vars: { won } }, ok: false };
    const rob = g.ramTeam === 1;
    const m = rob ? (won - 6) * 2 : won - 6;
    return {
      mult: fin(m),
      need: { key: rob ? "need.ryosto" : "need.rami", vars: { won, points: won - 6 } },
      ok: true,
    };
  }
  if (won > 6) return { mult: 0, need: { key: "need.noloBust", vars: { won } }, ok: false };
  return { mult: fin(7 - won), need: { key: "need.nolo", vars: { won } }, ok: true };
}

export function tuppiMult(g: TuppiState): number {
  return tuppiInfo(g).mult;
}

export function finalScore(g: TuppiState & Pick<GameState, "base">): number {
  return Math.round(g.base * tuppiMult(g));
}

type ScoreState = Pick<
  GameState,
  | "mode"
  | "ramTeam"
  | "usTricks"
  | "themTricks"
  | "scored"
  | "boss"
  | "chipBonus"
  | "money"
  | "sideDeck"
  | "jokers"
  | "hands"
>;

/* Pure: the money it earns comes back in ctx.payout and the reducer applies
   it. The scoring order is locked — see CLAUDE.md. */
export function scoreTrick(
  g: ScoreState,
  winnerSeat: Seat,
  leadSeat: Seat,
  cards: Card[],
): ScoreContext {
  const type = evalTrick(cards);
  const ctx: ScoreContext = {
    cards,
    winner: winnerSeat,
    lead: leadSeat,
    type,
    mode: g.mode,
    robbery: g.mode === "rami" && g.ramTeam === 1,
    usBefore: g.usTricks,
    themBefore: g.themTricks,
    scoredBefore: g.scored,
    chips: type.chips + cards.reduce((a, c) => a + chipValue(g, c), 0),
    mult: g.boss && g.boss.id === "kasijarru" ? 1 : type.mult,
    /* Jokers read game state only through ctx, which keeps content.ts pure
       data. */
    money: g.money,
    sideDeckEnh: g.sideDeck.filter((c) => c.enh).length,
    payout: 0,
    steel: 0,
    times: 1,
    total: 0,
  };
  /* The order: card additions, joker additions, card multipliers, joker
     multipliers, retriggers and money. */
  ctx.mult += 5 * cards.filter((c) => c.enh === "mult").length;
  for (const j of g.jokers) if (j.add) j.add(ctx);
  for (const c of cards) if (c.enh === "glass") ctx.chips *= 2;
  /* a steel card counts for as long as it is still unplayed */
  const steel = (g.hands[0] || []).filter((c) => c.enh === "steel").length;
  for (let i = 0; i < steel; i++) ctx.mult *= 1.5;
  ctx.steel = steel;
  for (const j of g.jokers) if (j.xm) ctx.mult *= j.xm(ctx);
  let times = 1;
  for (const j of g.jokers) if (j.retrig) times += j.retrig(ctx);
  for (const j of g.jokers) if (j.won) j.won(ctx);
  ctx.payout += 3 * cards.filter((c) => c.enh === "gold").length;
  ctx.mult = Math.max(1, ctx.mult);
  ctx.times = times;
  ctx.total = Math.round(ctx.chips * ctx.mult) * times;
  return ctx;
}
