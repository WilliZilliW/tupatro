import { isStone, matchesSuit, rv } from "./cards.js";
import { rnd } from "./rng.js";
import { currentWinner, leadSuit, legalCards, trickSize } from "./rules.js";

export function handPower(g, p) {
  const h = g.hands[p];
  let s = 0;
  for (const c of h) s += c.r === 14 ? 3 : c.r === 13 ? 2 : c.r === 12 ? 1 : 0;
  const bySuit = {};
  h.forEach((c) => (bySuit[c.s] = (bySuit[c.s] || 0) + 1));
  for (const k in bySuit) if (bySuit[k] <= 1) s += 1;
  return s;
}

export function aiDeclare(g, p) {
  return handPower(g, p) >= 9 ? "rami" : "nolo";
}

export function chooseAI(g, p) {
  const legal = legalCards(g, p);
  if (g.boss && g.boss.id === "umpimahka" && p === 2 && !g.sooli)
    return legal[Math.floor(rnd() * legal.length)];

  const low = (a) => a.slice().sort((x, y) => rv(g, x) - rv(g, y))[0];
  const high = (a) => a.slice().sort((x, y) => rv(g, y) - rv(g, x))[0];
  /* Ramissa vastustaja haluaa tikkejä, nolossa väistää niitä.
     Soolissa ramaajat pelaavat matalaa: tavoite on pakottaa soolaaja viemään tikki. */
  const wantsTricks = g.sooli ? false : g.mode === "rami";

  if (!g.trick.length) {
    /* Soolia vastaan matala aloitus on tappava; kerhopelaaja ei kuitenkaan osu siihen joka kerta. */
    if (g.sooli) return rnd() < 0.35 ? low(legal) : legal[Math.floor(rnd() * legal.length)];
    if (!wantsTricks) return low(legal);
    const aces = legal.filter((c) => rv(g, c) === 14);
    if (aces.length) return aces[0];
    const bySuit = {};
    legal.forEach((c) => {
      if (!isStone(c)) (bySuit[c.s] = bySuit[c.s] || []).push(c);
    });
    if (!Object.keys(bySuit).length) return legal[0];
    const suits = Object.keys(bySuit).sort((a, b) => bySuit[b].length - bySuit[a].length);
    return bySuit[suits[0]].slice().sort((a, b) => rv(g, b) - rv(g, a))[0];
  }

  const w = currentWinner(g);
  const ls = leadSuit(g);
  const partner = (p + 2) % 4;
  const last = g.trick.length === trickSize(g) - 1;
  const wStone = isStone(w.card);
  const canWin = legal.filter((c) => matchesSuit(c, ls) && (wStone || rv(g, c) > rv(g, w.card)));

  if (!wantsTricks) {
    /* nolo: kivikortti on varma väistö, muuten pysy alle */
    const stones = legal.filter(isStone);
    if (stones.length) return stones[0];
    const under = legal.filter((c) => matchesSuit(c, ls) && !wStone && rv(g, c) < rv(g, w.card));
    if (under.length) return under[under.length - 1];
    if (legal.every((c) => !matchesSuit(c, ls))) return high(legal); /* tyhjä maa: heitä roskat */
    return low(legal);
  }
  if (w.p === partner && !g.sooli && (last || rv(g, w.card) >= 13)) return low(legal);
  if (canWin.length) return low(canWin);
  return low(legal);
}

/* ============================ pisteytys ============================ */
