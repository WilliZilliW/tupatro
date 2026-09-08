import { SUITS } from "./constants";
import { PARTIES, PARTY_IDS } from "./content";
import { makeRng, normalizeSeed, seedHash, shuffle } from "./rng";
import type { Card, GameState, PlayerEconomy, Seat, SeatKind } from "./types";

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

/* ==================== one seat's wallet ====================
   Every seat starts with the same shell, the starting purse included: a
   seat-dependent purse would be a balance decision, and the run owner is the
   only seat that ever spends one today. The factory is what keeps the
   seventeen fields in one place — the createRun invariant scans this block. */
export function newEconomy(): PlayerEconomy {
  // prettier-ignore
  return {
    money:6,
    jokers:[], consumables:[], vouchers:[],
    jokerSlots:4, consSlots:2, shopSlots:3, chipBonus:0, tuppiBonus:0,
    sideDeck:[], sideSlots:5, swaps:2, swapsLeft:2, usedSide:[],
    shop:null, shopAfterBoss:false, rerollCost:5,
  };
}

/* The seat is a parameter with a default rather than a required argument, so
   every existing call site — rehydrate, initialState, startChallenge, the
   tests — keeps compiling and no pinned golden moves. Exactly one seat is
   human; the lobby is what picks which.

   `table` is the fourth parameter for the same reason: only a hosted game has
   an opinion about all four chairs at once, and given one it overrides the
   single seat rather than arguing with it. Every existing call passes three
   arguments or fewer and gets exactly the run it got before. */
export function createRun(
  seed?: string | null,
  bestAnte = 0,
  seat: Seat = 0,
  table?: [SeatKind, SeatKind, SeatKind, SeatKind],
): GameState {
  const s = normalizeSeed(seed);
  const seats =
    table ?? ([0, 1, 2, 3].map((p) => (p === seat ? "human" : "ai")) as GameState["seats"]);
  // prettier-ignore
  return {
    seed: s,
    rngState: seedHash(s) | 0,
    uidSeq: 0,
    partyMap: rollParties(s), support: zeroSupport(),

    ante:1, blindIdx:0,
    economies:[newEconomy(),newEconomy(),newEconomy(),newEconomy()],
    seats,
    beaten:[false,false,false,false],
    dealer:3, phase:"blindselect",
    hands:[[],[],[],[]], trick:[], leader:0, turn:0,
    mode:null, ramSeat:null, ramTeam:null, shows:[null,null,null,null],
    declSeq:[], declIdx:0,
    sooli:false, sooliSeat:null, sooliOrder:null, sooliBust:false, sooliExchange:null,
    tricks:[0,0], scored:0, base:0, target:0,
    deals:4, blindDeals:4, dealsLeft:4, blindScore:0, handScore:0, runScore:0,
    boss:null, reveal:false, steal:false,
    sortMode:"suit", customOrder:false,
    trickNo:0, winSeat:null,
    challenge:null, table:[], layHands:[[],[]], layTurn:0, layNo:0, layPassed:0,
    layScores:[0,0], parked:null,
    raceDeal:0, raceBase:[0,0], raceScores:[0,0],
    screen:{ kind:"blindselect" }, modal:null, menu:null, runStarted:false,
    toast:null, toastSeq:0, pop:null,
    bestAnte,
  };
}

/* ============================ hand order ============================ */

/* Exported for the laydown, whose two hands are a pair of card lists with no
   seat index — sortHand indexes the four-seat `hands` tuple and cannot reach
   them. */
export const bySuitThenRank = (a: Card, b: Card) =>
  SUITS.indexOf(a.s) - SUITS.indexOf(b.s) || b.r - a.r;

const byRankThenSuit = (a: Card, b: Card) => b.r - a.r || SUITS.indexOf(a.s) - SUITS.indexOf(b.s);

export function sortHand(g: Pick<GameState, "hands">, p: Seat): void {
  g.hands[p].sort(bySuitThenRank);
}

/* A human seat's own hand: the order the player chose, or one they dragged.
   The seat is a parameter because nothing here knows which seat is the
   player's. */
export function applySort(g: Pick<GameState, "hands" | "customOrder" | "sortMode">, p: Seat): void {
  if (g.customOrder) return;
  g.hands[p].sort(g.sortMode === "rank" ? byRankThenSuit : bySuitThenRank);
}
