import { original, produce } from "immer";
import { aiDeclare, chooseAI, chooseLaydown } from "./ai";
import { cardName, makeDeck, makeMint, mkCard, partyOf, type Mint } from "./cards";
import { ANTES, BLIND_MULT, BLIND_REWARD, RACE_TARGET, SM, partnerOf, teamOf } from "./constants";
import { BIG_BOSSES, CHALLENGES, SMALL_BOSSES } from "./content";
import { econOf } from "./economy";
import { pipTotal, validateLay, type LayResult } from "./laydown";
import { dealScores, matchOver, raceWinner, seatOfTeam } from "./race";
import { dehydrate, rehydrate } from "./save";
import { makeRng, pick, shuffle, type Rng } from "./rng";
import {
  anySwapAvailable,
  currentWinner,
  leadSuit,
  legalCards,
  nextSeat,
  ownerSeat,
  ownerTeam,
  scoresFor,
  swapTargets,
  trickSize,
} from "./rules";
import { finalScore, scoreTrick } from "./scoring";
import { applySort, bySuitThenRank, createRun, sortHand } from "./state";
import { cardSellValue, jokerSellValue, rollShopStock } from "./shop";
import type { Action } from "./actions";
import type { ChallengeId, GameState, Mode, Seat, Suit } from "./types";

const ALL_SEATS: Seat[] = [0, 1, 2, 3];

/* ============================ the reducer ============================
   One pure function: (state, action) -> new state. Immer's produce lets this
   read as though it mutated, while the result stays immutable — the same
   pattern Redux Toolkit uses.

   The RNG state and the uid counter are read from the state and written back,
   so the function stays pure even under StrictMode, which calls it twice.

   There are no timers here: the "auto" actions are dispatched by schedule.ts. */

type ToastSpec = {
  key: string;
  vars?: Record<string, string | number>;
  suit?: Suit;
  nameKey?: string;
};

function toast(d: GameState, spec: ToastSpec): void {
  d.toastSeq++;
  d.toast = { id: d.toastSeq, ...spec };
}

/* ============================ the deal ============================ */

function dealCards(d: GameState, rng: Rng, mint: Mint): void {
  const deck = shuffle(makeDeck(mint), rng);
  d.hands = [[], [], [], []];
  for (let i = 0; i < 52; i++) d.hands[i % 4].push(deck[i]);
  /* Every seat but the run owner's is sorted the fixed way; the owner's takes
     the order the player chose. */
  const own = ownerSeat(d);
  for (const p of ALL_SEATS) if (p !== own) sortHand(d, p);
  d.customOrder = false;
  applySort(d, own);
  d.trick = [];
  d.trickNo = 0;
}

/* One blind = several tuppi deals, the way tuppi collects points a deal at a
   time. */
function startDeal(d: GameState, rng: Rng, mint: Mint): void {
  d.tricks = [0, 0];
  d.scored = 0;
  d.base = 0;
  d.reveal = false;
  d.steal = false;
  d.sooli = false;
  d.sooliSeat = null;
  d.sooliOrder = null;
  d.sooliBust = false;
  d.sooliExchange = null;
  d.mode = null;
  d.ramSeat = null;
  d.ramTeam = null;
  d.shows = [null, null, null, null];
  d.winSeat = null;
  d.pop = null;
  dealCards(d, rng, mint);
  /* Harmaus closes the side deck, and it is closed here rather than in
     startBlind because every deal of the blind refills the swaps: gated once
     at the blind, the swap phase would reopen on the blind's second deal. The
     side deck is the only route an enhancement takes into a hand, so never
     opening the swap is the whole boss — matchesSuit, currentWinner and
     evalTrick stay state-free. */
  /* Every wallet's ration, not just the owner's: the reset consumes no
     randomness, and a per-deal allowance only one seat got back would be
     wrong the moment a second human sat down. */
  for (const p of ALL_SEATS) {
    const e = econOf(d, p);
    e.swapsLeft = d.boss?.id === "harmaus" ? 0 : e.swaps;
    e.usedSide = [];
  }
  d.screen = null;
  d.modal = null;
  /* A Tuppi-Rummikub deal is forced rami: no swap, no declaration, no nolo, no
     sooli and no ryosto. The elder hand — the seat to the dealer's left —
     leads, because a deal with no declarer has nobody whose right-hand
     neighbour would, and that is tuppi's own opening lead in nolo. */
  if (d.challenge === "rummikub") {
    d.mode = "rami";
    d.ramSeat = null;
    d.ramTeam = null;
    d.leader = ((d.dealer + 1) % 4) as Seat;
    d.turn = d.leader;
    d.table = [];
    d.layHands = [[], []];
    d.layTurn = 0;
    d.layNo = 0;
    d.layPassed = 0;
    d.layScores = [0, 0];
    beginPlay(d);
    return;
  }
  /* A race deal is ordinary tuppi: the declaration, sooli and ryosto all
     happen, and finishDeclare sets ramSeat, ramTeam and leader exactly as it
     does in the main game. What it skips is the swap — a race has no
     tuppipakka to swap from — so it goes straight to the declaration. */
  if (d.challenge === "race") {
    d.raceBase = [0, 0];
    d.raceDeal++;
    runDeclarations(d);
    return;
  }
  const own = ownerSeat(d);
  if (econOf(d, own).swapsLeft > 0 && anySwapAvailable(d, own)) d.phase = "swap";
  else runDeclarations(d);
}

/* ==================== the declaration: rami or nolo ====================
   Tuppi: the elder hand (to the dealer's left) shows first, then clockwise.
   A red card = rami, a black one = nolo, no court cards and no ace.
   Rami is played if even one player declares it. */

export function declOrder(dealer: Seat): Seat[] {
  const o: Seat[] = [];
  for (let i = 0; i < 4; i++) o.push(((dealer + 1 + i) % 4) as Seat);
  return o;
}

function showCardFor(d: GameState, p: Seat, decl: Mode, rng: Rng) {
  const wantRed = decl === "rami";
  const cand = d.hands[p].filter((c) => c.r >= 2 && c.r <= 10 && SM[c.s].red === wantRed);
  return cand.length ? pick(rng, cand) : null;
}

function runDeclarations(d: GameState): void {
  d.phase = "declare";
  d.declSeq = declOrder(d.dealer);
  d.declIdx = 0;
}

function finishDeclare(d: GameState): void {
  const first = d.declSeq.find((p) => d.shows[p]?.decl === "rami");
  if (first === undefined) {
    d.mode = "nolo";
    d.ramSeat = null;
    d.ramTeam = null;
    d.leader = ((d.dealer + 1) % 4) as Seat; /* in nolo the elder hand leads */
  } else {
    d.mode = "rami";
    d.ramSeat = first;
    d.ramTeam = teamOf(first);
    d.leader = ((first + 3) % 4) as Seat; /* the declarer's right-hand side leads */
  }
  d.turn = d.leader;
  /* Sooli is offered only when the other side is the one playing rami, and
     only to a human: the opponents have never taken a sooli. The club's rule
     sheet lets either defender take it; this engine offers it to one seat,
     which is what it has always done. */
  const def =
    d.mode === "rami" && d.ramTeam !== null
      ? ALL_SEATS.find((p) => d.seats[p] === "human" && teamOf(p) !== d.ramTeam)
      : undefined;
  if (def !== undefined) {
    d.sooliSeat = def;
    d.phase = "soolioffer";
    return;
  }
  beginPlay(d);
}

function beginPlay(d: GameState): void {
  d.phase = "play";
  d.screen = null;
}

/* ============================ tricks ============================ */

function playCardInner(d: GameState, p: Seat, uid: string): void {
  const h = d.hands[p];
  const i = h.findIndex((c) => c.uid === uid);
  if (i < 0) return;
  const [card] = h.splice(i, 1);
  d.trick.push({ p, card });
  if (d.trick.length === trickSize(d)) d.phase = "resolve";
  else d.turn = nextSeat(d, d.turn);
}

function resolveTrick(d: GameState, rng: Rng): void {
  let w = currentWinner(d);
  if (!w) return;
  const own = ownerSeat(d);
  const ownTeam = teamOf(own);
  if (d.steal) {
    const wantMine = d.mode === "rami" && !d.sooli;
    const mine = d.trick.find((t) => t.p === own);
    const notMine = d.trick.find((t) => t.p !== own);
    if (wantMine && mine) w = mine;
    else if (!wantMine && notMine) w = notMine;
    d.steal = false;
  }
  const cards = d.trick.map((t) => t.card);
  const leadSeat = d.trick[0].p;
  d.winSeat = w.p;

  d.tricks[teamOf(w.p)]++;
  if (d.sooli && w.p === d.sooliSeat) d.sooliBust = true;

  /* Support: every card of a trick the run owner's side *collects* brings in
     one for its party. Read from the trick a pair wins, not from the tricks
     that score — those differ in nolo and sooli, where the game scores the
     tricks you dodge, so a nolo deal collects little support and a collapsed
     one collects a lot. Tallied after the theft consumable has had its say, so the stolen
     winner is the one that counts. A sooli trick holds three cards, so it
     brings in three: the rule is per card, not a flat four. A card the run's
     map does not know has no party to credit, and skipping it beats crediting
     a bucket named "undefined". */
  if (teamOf(w.p) === ownTeam)
    for (const c of cards) {
      const party = partyOf(d, c);
      if (party) d.support[party] += 1;
    }

  d.pop = null;
  /* A Tuppi-Rummikub deal scores nothing in the tricks: the thirteen of them
     exist only to deal the two laydown hands, so no evalTrick, no tuppi
     multiplier and no money. The deal's score is the laydown's alone. */
  if (d.challenge === "rummikub") {
    d.layHands[teamOf(w.p)].push(...cards);
    d.phase = "trickend";
    return;
  }
  /* A race scores the trick for *both* pairs, because a race is decided by the
     difference between them and the main game only ever asks about the run
     owner's side. Each call is given that pair's own seat: scoreTrick reads a
     wallet, and handing it another pair's would be the wrong purse — invisible
     here, since every wallet in a race is empty, which is exactly why
     reducer.test.ts drives this branch with the non-owner's pair holding the
     one non-empty purse. race.test.ts guards dealScores, which is a different
     call site and cannot see this line.
     No money changes hands: ctx.payout is discarded and no seat has a purse to
     put it in. */
  if (d.challenge === "race") {
    for (const t of [0, 1] as const) {
      if (!scoresFor(d, t, w.p) || d.sooliBust) continue;
      const ctx = scoreTrick(d, t, seatOfTeam(t), w.p, leadSeat, cards);
      d.raceBase[t] += ctx.total;
      /* The pop is the run owner's pair's, the same seat-independent side the
         score pop has always described. */
      if (t !== ownTeam) continue;
      d.pop = {
        typeId: ctx.type.id,
        chips: ctx.chips,
        mult: ctx.mult,
        times: ctx.times,
        total: ctx.total,
        dodged: d.mode === "nolo" || d.sooli,
      };
    }
    d.phase = "trickend";
    return;
  }
  if (scoresFor(d, ownTeam, w.p) && !d.sooliBust) {
    const ctx = scoreTrick(d, ownTeam, own, w.p, leadSeat, cards);
    d.base += ctx.total;
    d.scored++;
    if (ctx.payout) econOf(d, own).money += ctx.payout;
    d.pop = {
      typeId: ctx.type.id,
      chips: ctx.chips,
      mult: ctx.mult,
      times: ctx.times,
      total: ctx.total,
      dodged: d.mode === "nolo" || d.sooli,
    };
    /* a glass card can break out of the side deck for good */
    const side = econOf(d, own).sideDeck;
    for (const c of cards) {
      if (c.enh !== "glass" || !c.srcUid) continue;
      if (rng.next() >= 0.25) continue;
      const idx = side.findIndex((x) => x.uid === c.srcUid);
      if (idx >= 0) {
        side.splice(idx, 1);
        toast(d, { key: "toast.glassBroke", vars: { card: cardName(c) } });
      }
    }
  }
  d.phase = "trickend";
}

function endTrick(d: GameState): void {
  const winner = d.winSeat ?? d.leader;
  d.winSeat = null;
  d.trick = [];
  d.trickNo++;
  if (d.sooliBust || d.trickNo >= 13) {
    /* Only Tuppi-Rummikub turns the thirteenth trick into a laydown. A race
       ends its deal the way the main game does. */
    if (d.challenge === "rummikub") startLaydown(d);
    else endHand(d);
    return;
  }
  d.leader = winner;
  d.turn = winner;
  if (d.sooli && d.sooliOrder && d.sooliSeat !== null) {
    /* the sooli player always plays last */
    const solo = d.sooliSeat;
    const other = d.sooliOrder.filter((x) => x !== solo && x !== winner)[0];
    d.sooliOrder = [winner, other, solo];
  }
  d.phase = "play";
}

function endHand(d: GameState): void {
  d.phase = "handend";
  /* A race banks both pairs and neither counts down a blind: there is no
     blind, and dealsLeft is inert for a mode with no fixed length. handScore
     is still the run owner's pair's, which is what the shared deal-end screen
     and the score toasts report. */
  if (d.challenge === "race") {
    const sc = dealScores(d);
    d.raceScores[0] += sc[0];
    d.raceScores[1] += sc[1];
    d.handScore = sc[ownerTeam(d)];
    return;
  }
  const sc = finalScore(d, ownerTeam(d), ownerSeat(d));
  d.handScore = sc;
  d.blindScore += sc;
  d.dealsLeft--;
}

/* ============================ the laydown ============================ */

function startLaydown(d: GameState): void {
  d.table = [];
  d.layNo = 0;
  d.layPassed = 0;
  d.layScores = [0, 0];
  d.layHands[0].sort(bySuitThenRank);
  d.layHands[1].sort(bySuitThenRank);
  /* "The side that won the rami" is the side with at least seven of the
     thirteen tricks: a forced-rami deal has no declarer to point at, seven is
     what wins a rami in tuppi, and with thirteen tricks exactly one side
     always has it. */
  d.layTurn = d.tricks[0] >= 7 ? 0 : 1;
  d.phase = "laydown";
}

function applyLay(d: GameState, side: 0 | 1, res: Extract<LayResult, { ok: true }>): void {
  const laid = new Set(res.laid.map((c) => c.uid));
  d.table = res.table;
  d.layHands[side] = d.layHands[side].filter((c) => !laid.has(c.uid));
  d.layScores[side] += pipTotal(res.laid);
}

/* Both a lay and a pass end the turn. Two passes in a row means neither side
   can place another card, which is where the laydown stops — and it always
   terminates, because a turn either lays one of the 52 cards or passes. */
function endLayTurn(d: GameState, passed: boolean): void {
  d.layNo++;
  d.layPassed = passed ? d.layPassed + 1 : 0;
  d.layTurn = d.layTurn === 0 ? 1 : 0;
  if (d.layPassed >= 2) endLaydown(d);
}

/* Pips laid minus cards left, and nothing else. Deliberately not clamped: a
   side that wins four cards and cannot use them scores -4, and the run total
   may be negative too. */
function endLaydown(d: GameState): void {
  const own = ownerTeam(d);
  const sc = d.layScores[own] - d.layHands[own].length;
  d.handScore = sc;
  d.blindScore += sc;
  d.dealsLeft--;
  d.phase = "handend";
}

/* ==================== starting and leaving a challenge ====================
   Both replace the whole state rather than mutating it, so they are handled
   outside apply() beside newRun. */

function startChallenge(
  prev: GameState,
  id: ChallengeId,
  seed?: string,
  humans: 1 | 2 | 3 | 4 = 1,
): GameState {
  const row = CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0];
  const own = ownerSeat(prev);
  /* Humans seated clockwise from the chair the parked run was played in: 1 is
     solo against three AI, 2 a duel across the table — partners sit opposite,
     so (own + 1) % 4 is an opponent, not partnerOf(own) — 3 two humans and an
     AI against one human, and 4 a full table on one screen. */
  const seats: GameState["seats"] = ["ai", "ai", "ai", "ai"];
  for (let i = 0; i < humans; i++) seats[((own + i) % 4) as Seat] = "human";
  const g: GameState = {
    /* The challenge is played from the chair the parked run was played in:
       entering one must not silently move the player back to seat 0 and hand
       the deal to an AI in their own chair. `prev` is the plain state, not the
       Immer draft, so ownerSeat reads the run's real seats. */
    ...createRun(seed, prev.bestAnte, own),
    challenge: row.id,
    seats,
    runStarted: true,
    menu: null,
    screen: null,
    /* None of the roguelike shell: no money, no jokers, no vouchers, no
       consumables, no tuppipakka and no boss. createRun already empties the
       lists and the purses are emptied below. The target is the one field a
       race keeps — it is the match target, and nothing else reads it. */
    target: row.id === "race" ? RACE_TARGET : 0,
    deals: row.deals,
    blindDeals: row.deals,
    dealsLeft: row.deals,
    raceDeal: 0,
    raceBase: [0, 0],
    raceScores: [0, 0],
    /* The main run is parked whole, so leaving gives it back exactly —
       mid-deal included. It is never written to disk: "parked" is dropped
       from every snapshot, which is also why a challenge started from within
       a challenge (Play again) carries the park across rather than dehydrating
       the challenge: dehydrate would drop it and lose the main run. */
    parked: prev.challenge !== null ? prev.parked : dehydrate(prev),
  };
  /* Every wallet, not the owner's alone: a challenge is played with no
     economy at all, so there is no seat whose purse it would be. */
  for (const e of g.economies) e.money = 0;
  const rng = makeRng(g.rngState);
  const mint = makeMint(g.uidSeq);
  startDeal(g, rng, mint);
  g.rngState = rng.state;
  g.uidSeq = mint.seq;
  return g;
}

function leaveChallenge(prev: GameState): GameState {
  const back = rehydrate(prev.parked, prev.bestAnte);
  return { ...(back ?? createRun(undefined, prev.bestAnte)), menu: "start" };
}

/* The money is worked out in the state transition, not while drawing the
   screen: the same screen can redraw (a language switch), and the reward must
   not be paid twice. */
function cashOut(d: GameState): void {
  /* Every one of these transitions credits the owner: none of them carries a
     seat, and the shell belongs to the seat that plays the run. */
  const e = econOf(d, ownerSeat(d));
  const won = d.tricks[ownerTeam(d)];
  const over = d.sooli ? 0 : d.mode === "rami" ? Math.max(0, won - 6) : Math.max(0, 7 - won);
  /* Verokarhu takes the interest of the blind it sits on, and only that one: a
     lost blind never reaches cash-out, so the boss bites a purse you won with. */
  const interest = d.boss?.id === "verokarhu" ? 0 : Math.min(5, Math.floor(e.money / 5));
  const reward = BLIND_REWARD[d.blindIdx];
  const bonus = d.sooli ? 6 : over;
  const spare = Math.max(0, d.dealsLeft);
  e.money += reward + bonus + interest + spare;
  /* The run's total is what cash-out banked, so the blind a run dies on adds
     nothing. showHandResult's screen guard keeps this from counting twice. */
  d.runScore += d.blindScore;
  d.screen = {
    kind: "cashout",
    score: d.handScore,
    reward,
    bonus,
    interest,
    spare,
    bank: e.money,
  };
}

/* ============================ blinds ============================ */

function nextBlind(d: GameState): void {
  d.beaten[d.blindIdx] = true;
  /* The ante rolls over off its last blind, the big boss, and winning is
     beating that boss at the last ante. */
  if (d.blindIdx === BLIND_MULT.length - 1) {
    if (d.ante >= ANTES.length) {
      d.bestAnte = Math.max(d.bestAnte, ANTES.length + 1);
      d.screen = { kind: "victory" };
      return;
    }
    d.ante++;
    d.blindIdx = 0;
    d.beaten = [false, false, false, false];
  } else d.blindIdx++;
  d.dealer = ((d.dealer + 1) % 4) as Seat;
  d.phase = "blindselect";
  d.screen = { kind: "blindselect" };
}

/* ============================ consumables ============================ */

/* The trick comes out of the acting seat's own box. What it then does to the
   hands is still the run owner's business: the shell belongs to one seat, and
   splitting a consumable's effect between two live wallets is a later
   spec. */
function useConsumable(d: GameState, p: Seat, index: number, rng: Rng, mint: Mint): void {
  const box = econOf(d, p).consumables;
  const c = box[index];
  if (!c) return;
  /* First, ahead of the phase guard: under this boss the trick is refused in
     every phase, so the player is told about the boss rather than about the
     phase. The item is kept — the boss shuts the tricks for its blind, it does
     not take them away. */
  if (d.boss?.id === "temppukielto") {
    toast(d, { key: "toast.tricksBanned" });
    return;
  }
  if (d.phase !== "play") {
    toast(d, { key: "toast.waitForDeal" });
    return;
  }
  if ((c.id === "uusijako" || c.id === "kannanvaihto") && d.trickNo > 0) {
    toast(d, { key: "toast.onlyBeforeFirstTrick", nameKey: c.key });
    return;
  }
  if (c.id === "kannanvaihto" && d.sooli) {
    toast(d, { key: "toast.noFlipInSooli" });
    return;
  }
  box.splice(index, 1);

  if (c.id === "kurkistus") {
    d.reveal = true;
    toast(d, { key: "toast.peeked" });
  }
  if (c.id === "tikkivarkaus") {
    d.steal = true;
    toast(d, { key: "toast.theftArmed" });
  }
  if (c.id === "kannanvaihto") {
    if (d.mode === "rami") {
      d.mode = "nolo";
      d.ramSeat = null;
      d.ramTeam = null;
      toast(d, { key: "toast.becameNolo" });
    } else {
      /* Flipping to rami makes the run owner the declarer: it is their card
         that buys the change of heart. */
      const own = ownerSeat(d);
      d.mode = "rami";
      d.ramSeat = own;
      d.ramTeam = teamOf(own);
      toast(d, { key: "toast.becameRami" });
    }
  }
  if (c.id === "vaihtokauppa") {
    const own = ownerSeat(d);
    const mine = d.hands[own];
    const mate = d.hands[partnerOf(own)];
    if (mine.length && mate.length) {
      const worst =
        d.mode === "nolo"
          ? mine
              .slice()
              .sort((a, b) => b.r - a.r)[0] /* in nolo the highest card is the worst one */
          : mine.slice().sort((a, b) => a.r - b.r)[0];
      const best =
        d.mode === "nolo"
          ? mate.slice().sort((a, b) => a.r - b.r)[0]
          : mate.slice().sort((a, b) => b.r - a.r)[0];
      mine.splice(
        mine.findIndex((x) => x.uid === worst.uid),
        1,
      );
      mate.splice(
        mate.findIndex((x) => x.uid === best.uid),
        1,
      );
      mine.push(best);
      mate.push(worst);
      applySort(d, own);
      sortHand(d, partnerOf(own));
      toast(d, { key: "toast.swapped", vars: { from: cardName(worst), to: cardName(best) } });
    }
  }
  if (c.id === "uusijako") {
    const dealer = d.dealer;
    dealCards(d, rng, mint);
    d.dealer = dealer;
    d.turn = d.leader;
    toast(d, { key: "toast.redealt" });
  }
}

/* ============================ the shop ============================ */

/* A purchase into a full inventory buys room by discarding one held item.
   `replace` is an index into that same array, spliced at the same tick the
   dispatch was read, so nothing can reorder the list in between — jokers and
   consumables carry no uid, and sellJoker/sellSideCard are index-based for the
   same reason.

   Returns false on a missing or out-of-range index, so the caller falls back
   to the toast the shop refused with before the picker existed: a bad index
   must never cost the player an item it did not name. */
function discardAt<T>(list: T[], replace: number | undefined): boolean {
  if (replace === undefined || !Number.isInteger(replace)) return false;
  if (replace < 0 || replace >= list.length) return false;
  list.splice(replace, 1);
  return true;
}

/* ============================ applying actions ============================ */

function apply(d: GameState, action: Action, rng: Rng, mint: Mint): void {
  switch (action.type) {
    case "startBlind": {
      const bi = d.blindIdx;
      /* Two pools, so the ante's two boss blinds always show different bosses.
         A boss may still repeat across antes. */
      d.boss = bi === 2 ? pick(rng, SMALL_BOSSES) : bi === 3 ? pick(rng, BIG_BOSSES) : null;
      d.target = Math.round(ANTES[d.ante - 1] * BLIND_MULT[bi]);
      d.blindScore = 0;
      /* Kiire takes a deal off this blind and leaves the run's allowance
         alone. Never below one: a blind with no deal could not be played. */
      d.blindDeals = d.boss?.id === "kiire" ? Math.max(1, d.deals - 1) : d.deals;
      d.dealsLeft = d.blindDeals;
      startDeal(d, rng, mint);
      return;
    }
    case "skipBlind": {
      /* Neither boss blind can be skipped, and both sit at index 2 or above. */
      if (d.blindIdx >= 2) return;
      econOf(d, ownerSeat(d)).money += 2;
      d.beaten[d.blindIdx] = true;
      d.blindIdx++;
      d.dealer = ((d.dealer + 1) % 4) as Seat;
      d.screen = { kind: "blindselect" };
      return;
    }

    /* --- the side deck: swap cards into hand before the declaration ---
       The card in hand is not a choice: same suit and same rank match exactly
       one card, so picking from the tuppipakka performs the whole swap. */
    case "pickSideCard": {
      const p = action.p;
      if (d.seats[p] !== "human") return;
      const e = econOf(d, p);
      const src = e.sideDeck.find((x) => x.uid === action.uid);
      if (!src || e.usedSide.includes(src.uid)) return;
      if (e.swapsLeft <= 0) {
        toast(d, { key: "toast.noSwapsLeft" });
        return;
      }
      const [gone] = swapTargets(d, p, src);
      if (!gone) {
        toast(d, { key: "toast.swapNoMatch", vars: { card: cardName(src) } });
        return;
      }
      const copy = mkCard(mint, src.s, src.r, src.enh);
      copy.srcUid = src.uid;
      d.hands[p].splice(d.hands[p].indexOf(gone), 1, copy);
      e.swapsLeft--;
      e.usedSide.push(src.uid);
      applySort(d, p);
      toast(d, { key: "toast.swapped", vars: { from: cardName(gone), to: cardName(copy) } });
      return;
    }
    case "finishSwap":
      if (d.seats[action.p] !== "human") return;
      runDeclarations(d);
      return;

    /* --- the declaration --- */
    case "aiDeclare": {
      const p = d.declSeq[d.declIdx];
      if (p === undefined || d.seats[p] === "human") return;
      const decl = aiDeclare(d, p);
      d.shows[p] = { decl, card: showCardFor(d, p, decl, rng) };
      d.declIdx++;
      return;
    }
    case "declare": {
      const p = action.p;
      if (d.seats[p] !== "human") return;
      if (d.declSeq[d.declIdx] !== p) return;
      /* The two forcing bosses bind the player only: an opponent under
         Pakkonolo may still take rami, which is the point of it. */
      const decl =
        d.boss?.id === "pakkorami" ? "rami" : d.boss?.id === "pakkonolo" ? "nolo" : action.decl;
      d.shows[p] = { decl, card: showCardFor(d, p, decl, rng) };
      d.declIdx++;
      return;
    }
    case "finishDeclare":
      if (d.declIdx < 4) return;
      finishDeclare(d);
      return;

    /* --- sooli --- */
    case "acceptSooli":
      if (d.phase !== "soolioffer" || action.p !== d.sooliSeat) return;
      d.sooli = true; /* from here on the ace is lowest */
      d.phase = "sooligive";
      return;
    case "declineSooli":
      if (d.phase !== "soolioffer" || action.p !== d.sooliSeat) return;
      beginPlay(d);
      return;
    case "sooliGive": {
      const p = action.p;
      if (d.phase !== "sooligive" || p !== d.sooliSeat) return;
      const i = d.hands[p].findIndex((c) => c.uid === action.uid);
      if (i < 0) return;
      const mate = d.hands[partnerOf(p)];
      if (!mate.length) return;
      const give = d.hands[p][i];
      const get = pick(rng, mate);
      d.hands[p].splice(i, 1);
      mate.splice(
        mate.findIndex((c) => c.uid === get.uid),
        1,
      );
      d.hands[p].push(get);
      applySort(d, p);
      d.hands[partnerOf(p)] = []; /* the partner sits out */
      /* The declarer leads. The fallback is only reached by a state no
         declaration produced: any seat of the other side will do. */
      const ram = d.ramSeat ?? (((p + 1) % 4) as Seat);
      const other = partnerOf(ram);
      d.sooliOrder = [ram, other, p]; /* the sooli player last */
      d.leader = ram;
      d.turn = ram;
      d.sooliExchange = { gave: give, got: get };
      d.phase = "sooliready";
      return;
    }
    case "startSooliPlay":
      if (d.phase !== "sooliready" || action.p !== d.sooliSeat) return;
      beginPlay(d);
      return;

    /* --- tricks --- */
    case "playCard": {
      if (d.phase !== "play") return;
      /* A human seat's card is checked against the follow-suit obligation; an
         opponent's comes from chooseAI, which only ever proposes a legal
         one. */
      if (d.seats[action.p] === "human") {
        if (d.turn !== action.p) return;
        const legal = legalCards(d, action.p);
        if (!legal.some((c) => c.uid === action.uid)) {
          const led = leadSuit(d);
          if (led) toast(d, { key: "toast.mustFollow", suit: led });
          return;
        }
      }
      playCardInner(d, action.p, action.uid);
      return;
    }
    case "aiPlay": {
      if (d.phase !== "play" || d.seats[d.turn] === "human") return;
      const card = chooseAI(d, d.turn, rng);
      playCardInner(d, d.turn, card.uid);
      return;
    }
    case "resolveTrick":
      if (d.phase !== "resolve") return;
      resolveTrick(d, rng);
      return;
    case "endTrick":
      if (d.phase !== "trickend") return;
      endTrick(d);
      return;
    case "showHandResult":
      /* The phase stays handend until the player continues, so an open screen
         is the mark that this step is already done. Without the guard the
         reward would be paid again on every call. */
      if (d.phase !== "handend" || d.screen) return;
      /* A race always opens a screen, match over or not. nextTick's handend
         case returns a tick whenever g.screen is null, and the phase
         deliberately stays handend, so a branch that returned without one
         would fire showHandResult forever. */
      if (d.challenge === "race") {
        const winner = raceWinner(d);
        /* matchOver and a non-null winner are the same condition — raceWinner
           is the pair at or past the target — and the null test is what the
           compiler needs to narrow the screen payload. */
        if (matchOver(d) && winner !== null) {
          /* Mirrors the challenge's runScore = blindScore: the run owner's
             pair's match total is what the board files. */
          d.runScore = d.raceScores[ownerTeam(d)];
          d.screen = {
            kind: "raceover",
            winner,
            scores: [d.raceScores[0], d.raceScores[1]],
            deals: d.raceDeal,
          };
          return;
        }
        d.screen = { kind: "dealend", score: d.handScore };
        return;
      }
      if (d.challenge === "rummikub") {
        if (d.dealsLeft > 0) {
          d.screen = { kind: "dealend", score: d.handScore };
          return;
        }
        /* No cash-out and no ante to bank against: the four deals' net scores
           are the run's score. */
        d.runScore = d.blindScore;
        d.screen = { kind: "challengeover", score: d.blindScore };
        return;
      }
      if (d.blindScore >= d.target) cashOut(d);
      else if (d.dealsLeft <= 0) {
        d.bestAnte = Math.max(d.bestAnte, d.ante);
        d.screen = { kind: "gameover" };
      } else d.screen = { kind: "dealend", score: d.handScore };
      return;
    case "nextDeal":
      d.dealer = ((d.dealer + 1) % 4) as Seat;
      startDeal(d, rng, mint);
      return;

    /* --- the laydown --- */
    case "layCards": {
      if (d.phase !== "laydown") return;
      if (d.seats[action.p] !== "human") return;
      /* Whose turn it is is the reducer's to know, not the panel's: a
         layCards on the opponents' turn would lay their cards. layTurn is a
         team, because tuppi collects tricks by pair. */
      const side = teamOf(action.p);
      if (d.layTurn !== side) return;
      /* Re-run rather than trust the panel: validateLay is the rule, and the
         panel is a convenience that runs the same function. */
      const res = validateLay(d.table, d.layHands[side], action.combos);
      if (!res.ok) {
        toast(d, { key: res.key });
        return;
      }
      applyLay(d, side, res);
      endLayTurn(d, false);
      return;
    }
    case "passLaydown":
      if (d.phase !== "laydown" || d.seats[action.p] !== "human") return;
      if (d.layTurn !== teamOf(action.p)) return;
      endLayTurn(d, true);
      return;
    case "aiLaydown": {
      if (d.phase !== "laydown") return;
      const side = d.layTurn;
      /* A team is a seat and its partner; the clock plays a turn only when
         neither of them is human. */
      if (d.seats[side] === "human" || d.seats[partnerOf(side)] === "human") return;
      const combos = chooseLaydown(d, side);
      const res = combos ? validateLay(d.table, d.layHands[side], combos) : null;
      /* The opponents pass rather than throwing when their own search
         proposes something the rule rejects. */
      if (!res || !res.ok) {
        endLayTurn(d, true);
        return;
      }
      applyLay(d, side, res);
      endLayTurn(d, false);
      return;
    }

    /* --- the shop --- */
    case "toShop": {
      /* One shop, rolled for the owner: rolling four would draw four times
         the randomness and a shop for an AI seat has no buyer. */
      const own = ownerSeat(d);
      const e = econOf(d, own);
      /* Vouchers stay one shop per ante: only the big boss's shop stocks them. */
      e.shopAfterBoss = d.blindIdx === BLIND_MULT.length - 1;
      e.shop = rollShopStock(d, own, rng, e.shopAfterBoss);
      e.rerollCost = 5;
      d.phase = "shop";
      d.screen = { kind: "shop" };
      return;
    }
    case "buy": {
      if (d.seats[action.p] !== "human") return;
      const e = econOf(d, action.p);
      const it = e.shop?.[action.index];
      if (!it || it.sold || e.money < it.price) return;
      /* `replace` is consulted only where the storage is actually full: with
         room the item is simply added and nothing is discarded, so a stray
         index cannot destroy anything. The toasts stay the rule's authority
         even though the shop now offers the picker instead of reaching them. */
      if (it.kind === "joker" && e.jokers.length >= e.jokerSlots) {
        if (!discardAt(e.jokers, action.replace)) {
          toast(d, { key: "toast.jokerSlotsFull" });
          return;
        }
      }
      if (it.kind === "card" && e.sideDeck.length >= e.sideSlots) {
        if (!discardAt(e.sideDeck, action.replace)) {
          toast(d, { key: "toast.sideDeckFull" });
          return;
        }
      }
      if (it.kind === "consumable" && e.consumables.length >= e.consSlots) {
        if (!discardAt(e.consumables, action.replace)) {
          toast(d, { key: "toast.trickSlotsFull" });
          return;
        }
      }
      /* The discard is free: the replaced item pays nothing back, so the price
         is the ordinary one and is charged exactly once. */
      e.money -= it.price;
      it.sold = true;
      if (it.kind === "joker") e.jokers.push(it.data);
      else if (it.kind === "card")
        e.sideDeck.push(mkCard(mint, it.data.card.s, it.data.card.r, it.data.card.enh));
      else if (it.kind === "consumable") e.consumables.push(it.data);
      else {
        e.vouchers.push(it.data.id);
        if (it.data.id === "teroitin") e.chipBonus += 3;
        if (it.data.id === "tuppisormus") e.tuppiBonus += 1;
        if (it.data.id === "kahvipannu") e.jokerSlots += 1;
        if (it.data.id === "muistikirja") {
          e.consSlots += 1;
          e.shopSlots += 1;
        }
        if (it.data.id === "hihalaukku") e.swaps += 1;
        if (it.data.id === "isompipakka") e.sideSlots += 1;
      }
      return;
    }
    case "reroll": {
      if (d.seats[action.p] !== "human") return;
      const e = econOf(d, action.p);
      /* A reroll replaces a shelf; it never creates one. Only the owner's
         wallet is given stock by toShop, so without this a seat whose `shop`
         is null would mint one out of nothing and spend the run's rng draws
         doing it — `buy` already refuses the same seat for the same reason. */
      if (!e.shop) return;
      if (e.money < e.rerollCost) return;
      e.money -= e.rerollCost;
      const cost = e.rerollCost;
      e.shop = rollShopStock(d, action.p, rng, e.shopAfterBoss);
      e.rerollCost = cost + 2;
      return;
    }
    case "sellJoker": {
      if (d.seats[action.p] !== "human") return;
      const e = econOf(d, action.p);
      const j = e.jokers[action.index];
      if (!j) return;
      const v = jokerSellValue(j);
      e.money += v;
      e.jokers.splice(action.index, 1);
      toast(d, { key: "toast.soldJoker", vars: { amount: v }, nameKey: j.key });
      return;
    }
    case "sellSideCard": {
      if (d.seats[action.p] !== "human") return;
      const e = econOf(d, action.p);
      const c = e.sideDeck[action.index];
      if (!c) return;
      const v = cardSellValue(c);
      e.money += v;
      e.sideDeck.splice(action.index, 1);
      toast(d, { key: "toast.soldCard", vars: { amount: v } });
      return;
    }
    case "nextBlind":
      nextBlind(d);
      return;

    /* --- consumables --- */
    case "useConsumable":
      if (d.seats[action.p] !== "human") return;
      useConsumable(d, action.p, action.index, rng, mint);
      return;

    /* --- the hand --- */
    case "setSortMode":
      if (d.seats[action.p] !== "human") return;
      d.sortMode = action.mode;
      d.customOrder = false;
      applySort(d, action.p);
      return;
    case "reorderHand": {
      if (d.seats[action.p] !== "human") return;
      const order = action.uids;
      d.hands[action.p].sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid));
      d.customOrder = true;
      return;
    }
    case "moveCard": {
      if (d.seats[action.p] !== "human") return;
      const h = d.hands[action.p];
      const i = h.findIndex((x) => x.uid === action.uid);
      const j = i + action.dir;
      if (i < 0 || j < 0 || j >= h.length) return;
      const tmp = h[i];
      h[i] = h[j];
      h[j] = tmp;
      d.customOrder = true;
      return;
    }

    /* --- the interface --- */
    case "showMenu":
      d.menu = action.view;
      return;
    case "closeMenu":
      d.menu = null;
      return;
    case "openModal":
      d.modal = action.modal;
      return;
    case "closeModal":
      d.modal = null;
      return;
    case "dismissToast":
      if (d.toast && d.toast.id === action.id) d.toast = null;
      return;
    case "clearPop":
      d.pop = null;
      return;
  }
}

export const gameReducer = produce((d: GameState, action: Action) => {
  /* A run started from the menu is one to come back to, and createRun leaves
     `menu` null, so starting one lowers the menu at the same time. */
  if (action.type === "newRun")
    return { ...createRun(action.seed, d.bestAnte, action.seat ?? 0), runStarted: true };
  /* Both of these replace the whole state, so they sit here rather than in
     apply(), which mutates the draft in place. `original` hands back the base
     state: dehydrate must read plain objects, not Immer drafts. */
  if (action.type === "startChallenge")
    return startChallenge(original(d) ?? d, action.id, action.seed, action.humans);
  if (action.type === "leaveChallenge") return leaveChallenge(original(d) ?? d);
  const rng = makeRng(d.rngState);
  const mint = makeMint(d.uidSeq);
  apply(d, action, rng, mint);
  d.rngState = rng.state;
  d.uidSeq = mint.seq;
  return undefined;
});
