import { chipValue, isStone, isWild } from "./cards.js";
import { TYPES } from "./constants.js";
import { t } from "./i18n.js";

/* ============================ pisteytys ============================ */
export function evalTrick(cards) {
  /* Kivikortilla ei ole arvoa eikä maata, joten se ei osallistu tikkityyppiin. */
  const live = cards.filter((c) => !isStone(c));
  if (live.length < 2) return TYPES.high;
  const ranks = live.map((c) => c.r).sort((a, b) => a - b);
  const flush = new Set(live.filter((c) => !isWild(c)).map((c) => c.s)).size <= 1;
  const counts = {};
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

/* Ramissa pisteytät viemäsi tikit, nolossa (ja soolissa) väistämäsi. */

/* Tuppi-kerroin. Ramissa 7. tikistä alkaen (4 pistettä/tikki -> ×1, ×2, ×3…),
   nolossa kuudesta alaspäin, ryöstössä kaksinkertaisena. */
export function tuppiInfo(g) {
  const won = g.usTricks;
  const bonus = g.jokers.reduce((a, j) => a + (j.tuppi || 0), 0) + g.tuppiBonus;
  const kitsas = g.boss && g.boss.id === "kitsas" ? 1 : 0;
  const fin = (m) => Math.max(1, m + bonus - kitsas);

  if (g.sooli) {
    if (g.sooliBust) return { mult: 0, need: t("need.sooliBust"), ok: false };
    return { mult: fin(6), need: t("need.sooli", { won }), ok: won === 0 };
  }
  if (g.mode === "rami") {
    if (won < 7) return { mult: 0, need: t("need.ramiShort", { won }), ok: false };
    const rob = g.ramTeam === 1;
    const m = rob ? (won - 6) * 2 : won - 6;
    return {
      mult: fin(m),
      need: t(rob ? "need.ryosto" : "need.rami", { won, points: won - 6 }),
      ok: true,
    };
  }
  if (won > 6) return { mult: 0, need: t("need.noloBust", { won }), ok: false };
  return { mult: fin(7 - won), need: t("need.nolo", { won }), ok: true };
}

export function tuppiMult(g) {
  return tuppiInfo(g).mult;
}

export function finalScore(g) {
  return Math.round(g.base * tuppiMult(g));
}

export function scoreTrick(g, winnerSeat, leadSeat, cards) {
  const type = evalTrick(cards);
  const ctx = {
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
    /* Jokerit lukevat pelitilaa vain ctx:n kautta, jotta content.js pysyy puhtaana datana. */
    money: g.money,
    sideDeckEnh: g.sideDeck.filter((c) => c.enh).length,
    payout: 0,
  };
  /* Järjestys: korttien lisäykset, jokerien lisäykset, korttien kertoimet, jokerien kertoimet. */
  ctx.mult += 5 * cards.filter((c) => c.enh === "mult").length;
  for (const j of g.jokers) if (j.add) j.add(ctx);
  for (const c of cards) if (c.enh === "glass") ctx.chips *= 2;
  /* teräskortti vaikuttaa niin kauan kuin se on yhä pelaamatta */
  const steel = (g.hands[0] || []).filter((c) => c.enh === "steel").length;
  for (let i = 0; i < steel; i++) ctx.mult *= 1.5;
  ctx.steel = steel;
  for (const j of g.jokers) if (j.xm) ctx.mult *= j.xm(ctx);
  let times = 1;
  for (const j of g.jokers) if (j.retrig) times += j.retrig(ctx);
  for (const j of g.jokers) if (j.won) j.won(ctx);
  ctx.payout += 3 * cards.filter((c) => c.enh === "gold").length;
  if (ctx.payout) g.money += ctx.payout;
  ctx.mult = Math.max(1, ctx.mult);
  ctx.times = times;
  ctx.total = Math.round(ctx.chips * ctx.mult) * times;
  return ctx;
}
