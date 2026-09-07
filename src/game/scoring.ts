import { chipValue, isStone, isWild } from "./cards";
import { econOf } from "./economy";
import { TYPES, partnerOf } from "./constants";
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
  "tricks" | "economies" | "boss" | "sooli" | "sooliBust" | "mode" | "ramTeam"
>;

/* The tuppi multiplier, asked about a team. In rami it starts at the 7th
   trick (4 points a trick -> ×1, ×2, ×3…), in nolo it counts down from six,
   and a ryosto — a rami the other team declared — doubles it. */
/* Asked about a team, and about the seat whose wallet pays for it: the joker
   row and the tuppisormus voucher belong to a wallet, and a team is two seats
   of which only one owns the shell. */
export function tuppiInfo(g: TuppiState, team: 0 | 1, p: Seat): TuppiInfo {
  const { jokers, tuppiBonus } = econOf(g, p);
  const won = g.tricks[team];
  const bonus = jokers.reduce((a, j) => a + (j.tuppi || 0), 0) + tuppiBonus;
  const kitsas = g.boss && g.boss.id === "kitsas" ? 1 : 0;
  const fin = (m: number) => Math.max(1, m + bonus - kitsas);

  if (g.sooli) {
    if (g.sooliBust) return { mult: 0, need: { key: "need.sooliBust" }, ok: false };
    return { mult: fin(6), need: { key: "need.sooli", vars: { won } }, ok: won === 0 };
  }
  if (g.mode === "rami") {
    if (won < 7) return { mult: 0, need: { key: "need.ramiShort", vars: { won } }, ok: false };
    /* A ryosto is a rami the *other* team declared. The null check is not
       decoration: a challenge deal is forced rami with no declarer, and
       "nobody declared it" is not a robbery. */
    const rob = g.ramTeam !== null && g.ramTeam !== team;
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

export function tuppiMult(g: TuppiState, team: 0 | 1, p: Seat): number {
  return tuppiInfo(g, team, p).mult;
}

export function finalScore(g: TuppiState & Pick<GameState, "base">, team: 0 | 1, p: Seat): number {
  return Math.round(g.base * tuppiMult(g, team, p));
}

type ScoreState = Pick<
  GameState,
  "mode" | "ramTeam" | "tricks" | "scored" | "boss" | "economies" | "hands"
>;

/* Pure: the money it earns comes back in ctx.payout and the reducer applies
   it. The scoring order is locked — see CLAUDE.md. */
/* `owner` is the seat whose wallet scores as well as the seat whose hand the
   steel cards are counted from: the scoring side is the one scoresFor picked,
   which in nolo and in sooli is precisely not the trick winner, so scoring
   the winner's wallet would score an empty purse on every dodged trick. */
export function scoreTrick(
  g: ScoreState,
  team: 0 | 1,
  owner: Seat,
  winnerSeat: Seat,
  leadSeat: Seat,
  cards: Card[],
): ScoreContext {
  const type = evalTrick(cards);
  const econ = econOf(g, owner);
  const ctx: ScoreContext = {
    cards,
    winner: winnerSeat,
    lead: leadSeat,
    type,
    mode: g.mode,
    robbery: g.mode === "rami" && g.ramTeam !== null && g.ramTeam !== team,
    team,
    owner,
    partner: partnerOf(owner),
    wonBefore: g.tricks[team],
    scoredBefore: g.scored,
    chips: type.chips + cards.reduce((a, c) => a + chipValue(g, owner, c), 0),
    mult: g.boss && g.boss.id === "kasijarru" ? 1 : type.mult,
    /* Jokers read game state only through ctx, which keeps content.ts pure
       data. */
    money: econ.money,
    sideDeckEnh: econ.sideDeck.filter((c) => c.enh).length,
    payout: 0,
    steel: 0,
    times: 1,
    total: 0,
  };
  /* The order: card additions, joker additions, card multipliers, joker
     multipliers, retriggers and money. */
  ctx.mult += 5 * cards.filter((c) => c.enh === "mult").length;
  for (const j of econ.jokers) if (j.add) j.add(ctx);
  for (const c of cards) if (c.enh === "glass") ctx.chips *= 2;
  /* a steel card counts for as long as it is still unplayed — the owner's,
     because the run's inventory is the owner's */
  const steel = (g.hands[owner] || []).filter((c) => c.enh === "steel").length;
  for (let i = 0; i < steel; i++) ctx.mult *= 1.5;
  ctx.steel = steel;
  for (const j of econ.jokers) if (j.xm) ctx.mult *= j.xm(ctx);
  let times = 1;
  for (const j of econ.jokers) if (j.retrig) times += j.retrig(ctx);
  for (const j of econ.jokers) if (j.won) j.won(ctx);
  ctx.payout += 3 * cards.filter((c) => c.enh === "gold").length;
  ctx.mult = Math.max(1, ctx.mult);
  ctx.times = times;
  ctx.total = Math.round(ctx.chips * ctx.mult) * times;
  return ctx;
}
