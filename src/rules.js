import { isStone, matchesSuit, rv } from "./cards.js";
import { isUs } from "./constants.js";

/* ============================ pelilogiikka ============================ */
export function trickSize(g) {
  return g.sooli ? 3 : 4;
}

export function nextSeat(g, p) {
  if (!g.sooli) return (p + 1) % 4;
  const i = g.sooliOrder.indexOf(p);
  return g.sooliOrder[(i + 1) % 3];
}
/* Ajettu maa = ensimmäisen maallisen kortin maa (kivikortti ei aja maata). */

/* Ajettu maa = ensimmäisen maallisen kortin maa (kivikortti ei aja maata). */
export function leadSuit(g) {
  for (const t of g.trick) if (!isStone(t.card)) return t.card.s;
  return null;
}

/* maantuntopakko — kivikortin saa aina pelata, villi kortti käy tunnustukseksi */

/* maantuntopakko — kivikortin saa aina pelata, villi kortti käy tunnustukseksi */
export function legalCards(g, p) {
  const h = g.hands[p],
    ls = leadSuit(g);
  if (ls === null) return h.slice();
  const follow = h.filter((c) => matchesSuit(c, ls));
  if (!follow.length) return h.slice();
  return follow.concat(h.filter(isStone));
}
/* ei valttia: tikin voittaa suurin kortti ajettua maata. Kivikortti ei voita koskaan,
   ja tasatilanteessa voittaa aiemmin pelattu kortti (vertailu on aidosti suurempi). */

/* ei valttia: tikin voittaa suurin kortti ajettua maata. Kivikortti ei voita koskaan,
   ja tasatilanteessa voittaa aiemmin pelattu kortti (vertailu on aidosti suurempi). */
export function currentWinner(g) {
  if (!g.trick.length) return null;
  const ls = leadSuit(g);
  let best = null;
  for (const t of g.trick) {
    if (!matchesSuit(t.card, ls)) continue;
    if (!best || rv(g, t.card) > rv(g, best.card)) best = t;
  }
  return best || g.trick[0];
}

/* Ramissa pisteytät viemäsi tikit, nolossa (ja soolissa) väistämäsi. */
export function scoresForUs(g, winnerSeat) {
  if (g.sooli) return winnerSeat !== 0;
  return g.mode === "rami" ? isUs(winnerSeat) : !isUs(winnerSeat);
}

/* Tuppi-kerroin. Ramissa 7. tikistä alkaen (4 pistettä/tikki -> ×1, ×2, ×3…),
   nolossa kuudesta alaspäin, ryöstössä kaksinkertaisena. */
