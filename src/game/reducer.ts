import { produce } from "immer";
import { aiDeclare, chooseAI } from "./ai";
import { cardName, makeDeck, makeMint, mkCard, sameFace, type Mint } from "./cards";
import { ANTES, BLIND_MULT, BLIND_REWARD, SM, isUs } from "./constants";
import { BOSSES } from "./content";
import { makeRng, pick, shuffle, type Rng } from "./rng";
import {
  anySwapAvailable,
  canSwapIn,
  currentWinner,
  leadSuit,
  legalCards,
  nextSeat,
  scoresForUs,
  trickSize,
} from "./rules";
import { finalScore, scoreTrick } from "./scoring";
import { applySort, createRun, sortHand } from "./state";
import { cardSellValue, jokerSellValue, rollShopStock } from "./shop";
import type { Action } from "./actions";
import type { GameState, Mode, Seat, Suit } from "./types";

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
  for (const p of [1, 2, 3] as const) sortHand(d, p);
  d.customOrder = false;
  applySort(d);
  d.trick = [];
  d.trickNo = 0;
}

/* One blind = several tuppi deals, the way tuppi collects points a deal at a
   time. */
function startDeal(d: GameState, rng: Rng, mint: Mint): void {
  d.usTricks = 0;
  d.themTricks = 0;
  d.scored = 0;
  d.base = 0;
  d.reveal = false;
  d.steal = false;
  d.sooli = false;
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
  d.swapsLeft = d.swaps;
  d.swapPick = null;
  d.usedSide = [];
  d.screen = null;
  d.modal = null;
  if (d.swapsLeft > 0 && anySwapAvailable(d)) d.phase = "swap";
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
    d.ramTeam = isUs(first) ? 0 : 1;
    d.leader = ((first + 3) % 4) as Seat; /* the declarer's right-hand side leads */
  }
  d.turn = d.leader;
  /* Sooli is offered only when the opponents are the ones playing rami. */
  if (d.mode === "rami" && d.ramTeam === 1) d.phase = "soolioffer";
  else beginPlay(d);
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
  if (d.steal) {
    const wantMine = d.mode === "rami" && !d.sooli;
    const mine = d.trick.find((t) => t.p === 0);
    const notMine = d.trick.find((t) => t.p !== 0);
    if (wantMine && mine) w = mine;
    else if (!wantMine && notMine) w = notMine;
    d.steal = false;
  }
  const cards = d.trick.map((t) => t.card);
  const leadSeat = d.trick[0].p;
  d.winSeat = w.p;

  if (isUs(w.p)) d.usTricks++;
  else d.themTricks++;
  if (d.sooli && w.p === 0) d.sooliBust = true;

  d.pop = null;
  if (scoresForUs(d, w.p) && !d.sooliBust) {
    const ctx = scoreTrick(d, w.p, leadSeat, cards);
    d.base += ctx.total;
    d.scored++;
    if (ctx.payout) d.money += ctx.payout;
    d.pop = {
      typeId: ctx.type.id,
      chips: ctx.chips,
      mult: ctx.mult,
      times: ctx.times,
      total: ctx.total,
      dodged: d.mode === "nolo" || d.sooli,
    };
    /* a glass card can break out of the side deck for good */
    for (const c of cards) {
      if (c.enh !== "glass" || !c.srcUid) continue;
      if (rng.next() >= 0.25) continue;
      const idx = d.sideDeck.findIndex((x) => x.uid === c.srcUid);
      if (idx >= 0) {
        d.sideDeck.splice(idx, 1);
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
    endHand(d);
    return;
  }
  d.leader = winner;
  d.turn = winner;
  if (d.sooli && d.sooliOrder) {
    /* the sooli player always plays last */
    const other = d.sooliOrder.filter((x) => x !== 0 && x !== winner)[0];
    d.sooliOrder = [winner, other, 0];
  }
  d.phase = "play";
}

function endHand(d: GameState): void {
  d.phase = "handend";
  const sc = finalScore(d);
  d.handScore = sc;
  d.blindScore += sc;
  d.dealsLeft--;
}

/* The money is worked out in the state transition, not while drawing the
   screen: the same screen can redraw (a language switch), and the reward must
   not be paid twice. */
function cashOut(d: GameState): void {
  const over = d.sooli
    ? 0
    : d.mode === "rami"
      ? Math.max(0, d.usTricks - 6)
      : Math.max(0, 7 - d.usTricks);
  const interest = Math.min(5, Math.floor(d.money / 5));
  const reward = BLIND_REWARD[d.blindIdx];
  const bonus = d.sooli ? 6 : over;
  const spare = Math.max(0, d.dealsLeft);
  d.money += reward + bonus + interest + spare;
  d.screen = {
    kind: "cashout",
    score: d.handScore,
    reward,
    bonus,
    interest,
    spare,
    bank: d.money,
  };
}

/* ============================ blinds ============================ */

function nextBlind(d: GameState): void {
  d.beaten[d.blindIdx] = true;
  if (d.blindIdx === 2) {
    if (d.ante >= 8) {
      d.bestAnte = Math.max(d.bestAnte, 9);
      d.screen = { kind: "victory" };
      return;
    }
    d.ante++;
    d.blindIdx = 0;
    d.beaten = [false, false, false];
  } else d.blindIdx++;
  d.dealer = ((d.dealer + 1) % 4) as Seat;
  d.phase = "blindselect";
  d.screen = { kind: "blindselect" };
}

/* ============================ consumables ============================ */

function useConsumable(d: GameState, index: number, rng: Rng, mint: Mint): void {
  const c = d.consumables[index];
  if (!c) return;
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
  d.consumables.splice(index, 1);

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
      d.mode = "rami";
      d.ramSeat = 0;
      d.ramTeam = 0;
      toast(d, { key: "toast.becameRami" });
    }
  }
  if (c.id === "vaihtokauppa") {
    const mine = d.hands[0];
    const mate = d.hands[2];
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
      applySort(d);
      sortHand(d, 2);
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

/* ============================ applying actions ============================ */

function apply(d: GameState, action: Action, rng: Rng, mint: Mint): void {
  switch (action.type) {
    case "startBlind": {
      const bi = d.blindIdx;
      d.boss = bi === 2 ? pick(rng, BOSSES) : null;
      d.target = Math.round(ANTES[d.ante - 1] * BLIND_MULT[bi]);
      d.blindScore = 0;
      d.dealsLeft = d.deals;
      startDeal(d, rng, mint);
      return;
    }
    case "skipBlind": {
      if (d.blindIdx >= 2) return;
      d.money += 2;
      d.beaten[d.blindIdx] = true;
      d.blindIdx++;
      d.dealer = ((d.dealer + 1) % 4) as Seat;
      d.screen = { kind: "blindselect" };
      return;
    }

    /* --- the side deck: swap cards into hand before the declaration --- */
    case "pickSideCard": {
      const c = d.sideDeck.find((x) => x.uid === action.uid);
      if (!c || d.usedSide.includes(c.uid)) return;
      if (d.swapsLeft <= 0) {
        toast(d, { key: "toast.noSwapsLeft" });
        return;
      }
      if (!canSwapIn(d, c)) {
        toast(d, { key: "toast.swapNoMatch", vars: { card: cardName(c) } });
        return;
      }
      d.swapPick = c;
      return;
    }
    case "cancelSidePick":
      d.swapPick = null;
      return;
    case "swapHandCard": {
      const src = d.swapPick;
      if (!src) {
        toast(d, { key: "toast.pickFromSideDeck" });
        return;
      }
      if (d.swapsLeft <= 0) {
        toast(d, { key: "toast.noSwapsLeft" });
        return;
      }
      const i = d.hands[0].findIndex((c) => c.uid === action.uid);
      if (i < 0) return;
      const gone = d.hands[0][i];
      /* Same suit, same rank, and not itself a card swapped in earlier. */
      if (gone.srcUid || !sameFace(src, gone)) {
        toast(d, { key: "toast.swapNeedsMatch", vars: { card: cardName(src) } });
        return;
      }
      const copy = mkCard(mint, src.s, src.r, src.enh);
      copy.srcUid = src.uid;
      d.hands[0].splice(i, 1, copy);
      d.swapsLeft--;
      d.usedSide.push(src.uid);
      d.swapPick = null;
      applySort(d);
      toast(d, { key: "toast.swapped", vars: { from: cardName(gone), to: cardName(copy) } });
      return;
    }
    case "finishSwap":
      d.swapPick = null;
      runDeclarations(d);
      return;

    /* --- the declaration --- */
    case "aiDeclare": {
      const p = d.declSeq[d.declIdx];
      if (p === undefined || p === 0) return;
      const decl = aiDeclare(d, p);
      d.shows[p] = { decl, card: showCardFor(d, p, decl, rng) };
      d.declIdx++;
      return;
    }
    case "declare": {
      if (d.declSeq[d.declIdx] !== 0) return;
      const forced = d.boss?.id === "pakkorami";
      const decl = forced ? "rami" : action.decl;
      d.shows[0] = { decl, card: showCardFor(d, 0, decl, rng) };
      d.declIdx++;
      return;
    }
    case "finishDeclare":
      if (d.declIdx < 4) return;
      finishDeclare(d);
      return;

    /* --- sooli --- */
    case "acceptSooli":
      d.sooli = true; /* from here on the ace is lowest */
      d.phase = "sooligive";
      return;
    case "declineSooli":
      beginPlay(d);
      return;
    case "sooliGive": {
      const i = d.hands[0].findIndex((c) => c.uid === action.uid);
      if (i < 0) return;
      const mate = d.hands[2];
      if (!mate.length) return;
      const give = d.hands[0][i];
      const get = pick(rng, mate);
      d.hands[0].splice(i, 1);
      mate.splice(
        mate.findIndex((c) => c.uid === get.uid),
        1,
      );
      d.hands[0].push(get);
      applySort(d);
      d.hands[2] = []; /* the partner sits out */
      const ram = d.ramSeat ?? 1;
      const other = ram === 1 ? 3 : 1;
      d.sooliOrder = [ram, other, 0]; /* the sooli player last */
      d.leader = ram;
      d.turn = ram;
      d.sooliExchange = { gave: give, got: get };
      d.phase = "sooliready";
      return;
    }
    case "startSooliPlay":
      beginPlay(d);
      return;

    /* --- tricks --- */
    case "playCard": {
      if (d.phase !== "play") return;
      if (action.p === 0) {
        if (d.turn !== 0) return;
        const legal = legalCards(d, 0);
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
      if (d.phase !== "play" || d.turn === 0) return;
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

    /* --- the shop --- */
    case "toShop":
      d.shopAfterBoss = d.blindIdx === 2;
      d.shop = rollShopStock(d, rng, d.shopAfterBoss);
      d.rerollCost = 5;
      d.phase = "shop";
      d.screen = { kind: "shop" };
      return;
    case "buy": {
      const it = d.shop?.[action.index];
      if (!it || it.sold || d.money < it.price) return;
      if (it.kind === "joker" && d.jokers.length >= d.jokerSlots) {
        toast(d, { key: "toast.jokerSlotsFull" });
        return;
      }
      if (it.kind === "card" && d.sideDeck.length >= d.sideSlots) {
        toast(d, { key: "toast.sideDeckFull" });
        return;
      }
      if (it.kind === "consumable" && d.consumables.length >= d.consSlots) {
        toast(d, { key: "toast.trickSlotsFull" });
        return;
      }
      d.money -= it.price;
      it.sold = true;
      if (it.kind === "joker") d.jokers.push(it.data);
      else if (it.kind === "card")
        d.sideDeck.push(mkCard(mint, it.data.card.s, it.data.card.r, it.data.card.enh));
      else if (it.kind === "consumable") d.consumables.push(it.data);
      else {
        d.vouchers.push(it.data.id);
        if (it.data.id === "teroitin") d.chipBonus += 3;
        if (it.data.id === "tuppisormus") d.tuppiBonus += 1;
        if (it.data.id === "kahvipannu") d.jokerSlots += 1;
        if (it.data.id === "muistikirja") {
          d.consSlots += 1;
          d.shopSlots += 1;
        }
        if (it.data.id === "hihalaukku") d.swaps += 1;
        if (it.data.id === "isompipakka") d.sideSlots += 1;
      }
      return;
    }
    case "reroll": {
      if (d.money < d.rerollCost) return;
      d.money -= d.rerollCost;
      const cost = d.rerollCost;
      d.shop = rollShopStock(d, rng, d.shopAfterBoss);
      d.rerollCost = cost + 2;
      return;
    }
    case "sellJoker": {
      const j = d.jokers[action.index];
      if (!j) return;
      const v = jokerSellValue(j);
      d.money += v;
      d.jokers.splice(action.index, 1);
      toast(d, { key: "toast.soldJoker", vars: { amount: v }, nameKey: j.key });
      return;
    }
    case "sellSideCard": {
      const c = d.sideDeck[action.index];
      if (!c) return;
      const v = cardSellValue(c);
      d.money += v;
      d.sideDeck.splice(action.index, 1);
      toast(d, { key: "toast.soldCard", vars: { amount: v } });
      return;
    }
    case "nextBlind":
      nextBlind(d);
      return;

    /* --- consumables --- */
    case "useConsumable":
      useConsumable(d, action.index, rng, mint);
      return;

    /* --- the hand --- */
    case "setSortMode":
      d.sortMode = action.mode;
      d.customOrder = false;
      applySort(d);
      return;
    case "reorderHand": {
      const order = action.uids;
      d.hands[0].sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid));
      d.customOrder = true;
      return;
    }
    case "moveCard": {
      const h = d.hands[0];
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
  if (action.type === "newRun") return createRun(action.seed, d.bestAnte);
  const rng = makeRng(d.rngState);
  const mint = makeMint(d.uidSeq);
  apply(d, action, rng, mint);
  d.rngState = rng.state;
  d.uidSeq = mint.seq;
  return undefined;
});
