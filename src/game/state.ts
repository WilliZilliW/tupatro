import { SUITS } from "./constants";
import { PARTIES, PARTY_IDS } from "./content";
import { makeRng, normalizeSeed, seedHash, shuffle } from "./rng";
import type { Card, GameState } from "./types";

/* ============================ state ============================
   One state object, and createRun defines every field so nothing is ever
   undefined. There is no ad hoc module state: everything mutable lives here. */

/* ==================== the party split ====================
   The requirement asks for an even split over the 52 cards and the 4 suits.
   Only 1 and 13 divide both 52 and the 13 cards of a suit, so the split is
   thirteen parties of four cards with exactly one card per suit — that is the
   reading, and it is also what makes the emblem carry information: knowing a
   card's suit tells you nothing about its party.

   Each suit gets its own permutation, so the party is independent of the rank
   as well: "all the aces are party X" is not the case.

   Rolled from a seed *derived* from the run's seed rather than from the run's
   own generator, so adding parties does not shift a single deal, boss or shop
   roll for an existing seed — g.rngState is left exactly where createRun put
   it. shuffle permutes in place, hence the copy: PARTY_IDS is a module-level
   constant and the rail plate's fixed order depends on it. */
function rollParties(seed: string): Record<string, string> {
  const rng = makeRng(seedHash(seed + ":party") | 0);
  const map: Record<string, string> = {};
  for (const s of SUITS) {
    const perm = shuffle(PARTY_IDS.slice(), rng);
    for (let r = 2; r <= 14; r++) map[s + r] = perm[r - 2];
  }
  return map;
}

function zeroSupport(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of PARTIES) out[p.id] = 0;
  return out;
}

export function createRun(seed?: string | null, bestAnte = 0): GameState {
  const s = normalizeSeed(seed);
  // prettier-ignore
  return {
    seed: s,
    rngState: seedHash(s) | 0,
    uidSeq: 0,
    partyMap: rollParties(s), support: zeroSupport(),

    ante:1, blindIdx:0, money:6,
    jokers:[], consumables:[], vouchers:[],
    jokerSlots:4, consSlots:2, shopSlots:3, chipBonus:0, tuppiBonus:0,
    sideDeck:[], sideSlots:5, swaps:2, swapsLeft:2, swapPick:null, usedSide:[],
    beaten:[false,false,false],
    dealer:3, phase:"blindselect",
    hands:[[],[],[],[]], trick:[], leader:0, turn:0,
    mode:null, ramSeat:null, ramTeam:null, shows:[null,null,null,null],
    declSeq:[], declIdx:0,
    sooli:false, sooliOrder:null, sooliBust:false, sooliExchange:null,
    usTricks:0, themTricks:0, scored:0, base:0, target:0,
    deals:4, dealsLeft:4, blindScore:0, handScore:0,
    boss:null, reveal:false, steal:false,
    sortMode:"suit", customOrder:false,
    trickNo:0, shop:null, shopAfterBoss:false, rerollCost:5, winSeat:null,
    screen:{ kind:"blindselect" }, modal:null,
    toast:null, toastSeq:0, pop:null,
    bestAnte,
  };
}

/* ============================ hand order ============================ */

const bySuitThenRank = (a: Card, b: Card) => SUITS.indexOf(a.s) - SUITS.indexOf(b.s) || b.r - a.r;

const byRankThenSuit = (a: Card, b: Card) => b.r - a.r || SUITS.indexOf(a.s) - SUITS.indexOf(b.s);

export function sortHand(g: Pick<GameState, "hands">, p: 1 | 2 | 3): void {
  g.hands[p].sort(bySuitThenRank);
}

/* Your own hand: the order the player chose, or one they dragged. */
export function applySort(g: Pick<GameState, "hands" | "customOrder" | "sortMode">): void {
  if (g.customOrder) return;
  g.hands[0].sort(g.sortMode === "rank" ? byRankThenSuit : bySuitThenRank);
}
