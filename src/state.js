import { SUITS } from "./constants.js";
import { setSeed } from "./rng.js";

/* ============================ tila ============================ */
export let G = null;

export let timers = [];

/* Kortit joiden pudotusanimaatio on jo näytetty. Tyhjennetään, ei korvata:
   tuotuun sidokseen ei voi sijoittaa. */
export const animatedIds = new Set();

/* Ainoa paikka jossa setTimeoutia kutsutaan. Kaikki ajastimet kulkevat tästä,
   jotta clearTimers() saa ne varmasti peruttua uuden ajon alkaessa. */
export function later(fn, ms) {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}

export function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

export function newGame(seed) {
  clearTimers();
  // prettier-ignore
  G = {
    seed:"",
    ante:1, blindIdx:0, money:6,
    jokers:[], consumables:[], vouchers:[],
    jokerSlots:4, consSlots:2, shopSlots:3, chipBonus:0, tuppiBonus:0,
    sideDeck:[], sideSlots:5, swaps:2, swapsLeft:2, swapPick:null, usedSide:[],
    beaten:[false,false,false],
    dealer:3, phase:"blindselect",
    hands:[[],[],[],[]], trick:[], leader:0, turn:0,
    mode:null, ramSeat:null, ramTeam:null, shows:[null,null,null,null],
    sooli:false, sooliOrder:null, sooliBust:false,
    usTricks:0, themTricks:0, scored:0, base:0, target:0,
    deals:4, dealsLeft:4, blindScore:0,
    boss:null, reveal:false, steal:false,
    sortMode:"suit", customOrder:false,
    trickNo:0, shop:null, rerollCost:5, winSeat:null
  };
  setSeed(G, seed);
  return G;
}

/* ============================ kortit ============================ */

export function sortHand(g, p) {
  g.hands[p].sort((a, b) => SUITS.indexOf(a.s) - SUITS.indexOf(b.s) || b.r - a.r);
}
/* Oma käsi: pelaajan valitsema järjestys, tai itse raahattu. */
export function applySort(g) {
  if (g.customOrder) return;
  const h = g.hands[0];
  if (g.sortMode === "rank") h.sort((a, b) => b.r - a.r || SUITS.indexOf(a.s) - SUITS.indexOf(b.s));
  else h.sort((a, b) => SUITS.indexOf(a.s) - SUITS.indexOf(b.s) || b.r - a.r);
}

/* ============================ jako ============================ */
