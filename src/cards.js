import { SM, SUITS, rankLabel } from "./constants.js";
import { ENH } from "./content.js";

export const isStone = (c) => c.enh === "stone";

export const isWild = (c) => c.enh === "wild";
/* ls === null: tikkiä on johtanut kivikortti, jolloin mikä tahansa maallinen kortti kilpailee. */

/* ls === null: tikkiä on johtanut kivikortti, jolloin mikä tahansa maallinen kortti kilpailee. */
export function matchesSuit(c, ls) {
  if (isStone(c)) return false;
  if (ls === null || ls === undefined) return true;
  return isWild(c) || c.s === ls;
}

export function enhOf(c) {
  return c.enh ? ENH[c.enh] : null;
}

/* ============================ kortit ============================ */
export let uidSeq = 0;
/* id = korttityyppi ("S14"), uid = yksilö. Tuppipakka voi tuoda kaksoiskappaleita. */

/* id = korttityyppi ("S14"), uid = yksilö. Tuppipakka voi tuoda kaksoiskappaleita. */
export function mkCard(s, r, enh) {
  return { s, r, id: s + r, uid: "c" + ++uidSeq, enh: enh || null };
}

export function makeDeck() {
  const d = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push(mkCard(s, r));
  return d;
}

/* Soolissa ässä on pienin. */
export function rv(g, c) {
  return g.sooli && c.r === 14 ? 1 : c.r;
}

export function chipValue(g, c) {
  if (isStone(c)) return 50 + g.chipBonus;
  let v = c.r === 14 ? 11 : c.r >= 11 ? 10 : c.r;
  if (c.enh === "bonus") v += 40;
  v += g.chipBonus;
  if (g.boss && g.boss.id === "punainen" && SM[c.s].red) v = 0;
  return Math.max(0, v);
}

export function cardName(c) {
  return rankLabel(c.r) + SM[c.s].g;
}
