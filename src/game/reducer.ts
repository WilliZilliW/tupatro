import { original, produce } from "immer";
import { aiDeclare, chooseAI, chooseLaydown, chooseSooliGive, shouldSooli } from "./ai";
import { cardName, isKingOfClubs, makeDeck, makeMint, mkCard, partyOf, type Mint } from "./cards";
import {
  ANTES,
  BLIND_MULT,
  BLIND_REWARD,
  PUOLUE_TERM,
  RPS_HAND,
  SM,
  partnerOf,
  sameTeam,
  teamOf,
  TUPATRO_DRAW,
} from "./constants";
import { BIG_BOSSES, CHALLENGES, CONSUMABLES, SMALL_BOSSES } from "./content";
import { econOf } from "./economy";
import { pipTotal, validateLay, type LayResult } from "./laydown";
import { NAMI_VARIANT, namiTrick } from "./nami";
import { dealPoints } from "./points";
import { politicsMode, sofiaIn } from "./politics";
import { governmentFor, puolueTrick, termOf } from "./puolue";
import { dealScores, matchOver, raceWinner, seatOfTeam } from "./race";
import { makeRpsDeck, rpsCompare, rpsFoe, rpsOver, rpsWinner } from "./rps";
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
  sooliCandidates,
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
  p?: Seat;
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
  d.revealTo = null;
  d.stealFor = null;
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
  /* Rock-Paper-Scissors deals from its own 41-card deck (makeRpsDeck), not
     makeDeck's 52, and this arm sits before dealCards on purpose, or the mode
     would shuffle the tuppi deck and mint thirteen cards nobody ever plays.
     Both cards are committed blind — the physical game's simultaneity
     expressed in a turn-based reducer — so the opponent's is drawn from the
     run's own seeded Rng right here, before the player can act at all, and it
     cannot react to the player even in principle. */
  if (d.challenge === "rps") {
    d.rpsRound = 0;
    d.rpsWins = [0, 0];
    d.rpsCards = [null, null];
    const own = ownerSeat(d);
    const foe = rpsFoe(d);
    const deck = shuffle(makeRpsDeck(mint), rng);
    d.hands = [[], [], [], []];
    for (let i = 0; i < RPS_HAND; i++) {
      d.hands[own].push(deck[i]);
      d.hands[foe].push(deck[RPS_HAND + i]);
    }
    drawRpsFoeCard(d, rng);
    d.phase = "rpsthrow";
    return;
  }
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
  /* A match deal in any of the three modes that *declare* — the race,
     Traditional Tuppi and Tupatro — is ordinary tuppi: the declaration, sooli
     and ryosto all happen, and finishDeclare sets ramSeat, ramTeam and leader
     exactly as it does in the main game. What it skips is the swap: no match
     mode has a tuppipakka to swap from, so it goes straight to the
     declaration. Nami is the match mode that does not declare, and it has its
     own arm below. The ids are spelled out rather than tested for truth —
     rummikub is a challenge too and is emphatically not this. */
  if (d.challenge === "race" || d.challenge === "tuppi" || d.challenge === "tupatro") {
    d.raceBase = [0, 0];
    d.raceDeal++;
    /* Tupatro's own supply: four draws every deal, in seat order, whatever
       the boxes already hold — see TUPATRO_DRAW's comment for why the draw is
       unconditional. A human seat with room keeps it; an AI seat or a full
       box discards it, but the randomness is spent regardless, so a Tupatro
       deal costs a fixed amount of it and what a seat is holding can never
       change what the *next* deal deals. */
    if (d.challenge === "tupatro") {
      for (const p of ALL_SEATS) {
        for (let i = 0; i < TUPATRO_DRAW; i++) {
          const drawn = pick(rng, CONSUMABLES);
          const e = econOf(d, p);
          if (d.seats[p] === "human" && e.consumables.length < e.consSlots)
            e.consumables.push(drawn);
        }
      }
    }
    runDeclarations(d);
    return;
  }
  /* A Nami deal is ordinary tuppi trick play with no declaration at all: the
     mode scores the *contents* of the tricks a pair captured, not a bet on
     their count, so rami, nolo, ryosto and sooli have nothing to decide and
     are skipped outright — the Tuppi-Rummikub precedent for a custom mode
     that suspends tuppi's usual scoring. `mode` is set to "rami" only so
     every mode-reading path has a defined value; it means nothing else here,
     exactly as it does not for Tuppi-Rummikub, and ModeBox/Hint are what say
     something true on the felt instead — the Nami branches in ai.ts and this
     file's own resolveTrick/endHand never read it. The elder hand leads,
     tuppi's own opening lead in a deal with no declarer. */
  if (d.challenge === "nami" || d.challenge === "namihard") {
    d.mode = "rami";
    d.ramSeat = null;
    d.ramTeam = null;
    d.leader = ((d.dealer + 1) % 4) as Seat;
    d.turn = d.leader;
    d.raceBase = [0, 0];
    d.raceDeal++;
    beginPlay(d);
    return;
  }
  /* Politiikka declares nothing at all: the deal type is a fixed rotation
     off raceDeal (politicsMode), not a choice, so no declaration, no swap
     phase, no sooli and no ryosto — the same "no declarer" shape Nami and
     Tuppi-Rummikub already use, applied to a mode whose deal type is decided
     rather than skipped outright. raceDeal is incremented first so deal one
     reads as politicsMode(1) — a hallituspeli, the government named first in
     the issue's own chat — and so a term rollover is read off the deal that
     is about to be played ((d.raceDeal - 1) % PUOLUE_TERM === 0 is true on
     deal 1, 5, 9, …), with the toast firing once per term rather than once
     per deal. The government itself is never computed or stored here: it is
     derived on demand from d.seed and termOf(d.raceDeal) wherever it is
     needed (resolveTrick, chooseAI, GovBox), so nothing here has to keep it
     in sync with anything else. The elder hand leads, tuppi's own opening
     lead in a deal with no declarer. */
  if (d.challenge === "politiikka") {
    d.raceDeal++;
    d.mode = politicsMode(d.raceDeal);
    d.ramSeat = null;
    d.ramTeam = null;
    d.leader = ((d.dealer + 1) % 4) as Seat;
    d.turn = d.leader;
    d.raceBase = [0, 0];
    if ((d.raceDeal - 1) % PUOLUE_TERM === 0) toast(d, { key: "toast.newGov" });
    beginPlay(d);
    return;
  }
  const own = ownerSeat(d);
  if (econOf(d, own).swapsLeft > 0 && anySwapAvailable(d, own)) d.phase = "swap";
  else runDeclarations(d);
}

/* ==================== rock-paper-scissors ====================
   No source claims the suit-to-throw mapping or the two clubs' trump table —
   they are this game's own invention, exactly like Tuppi-Rummikub's laydown
   and Nami's point tables. They also overrule WRPSA v1.0's own replayed tie
   and first-to-two match: the requirement is exactly RPS_ROUNDS rounds, a
   tie counts for neither side and is not replayed, and a drawn match (equal
   wins after all three) is a real outcome — both look like missing code
   without this comment, since a tie that does not increment the round and a
   match that keeps playing after one side has already won look like bugs. */

/* The opponent's next card, drawn uniformly from what it still holds and
   removed from its hand at once — committed, not merely chosen, so the same
   card can never be drawn twice and every match ends with both hands empty.
   Shared by startDeal's own arm (round one) and resolveRps (every round
   after), so the two sites cannot drift into drawing differently. */
function drawRpsFoeCard(d: GameState, rng: Rng): void {
  const foe = rpsFoe(d);
  const card = pick(rng, d.hands[foe]);
  d.hands[foe] = d.hands[foe].filter((c) => c.uid !== card.uid);
  d.rpsCards[teamOf(foe)] = card;
}

/* Reached only from rpsreveal, once both cards are in d.rpsCards. */
function resolveRps(d: GameState, rng: Rng): void {
  const own = ownerTeam(d);
  const foe = teamOf(rpsFoe(d));
  const mine = d.rpsCards[own];
  const theirs = d.rpsCards[foe];
  if (mine === null || theirs === null) return;
  const cmp = rpsCompare(mine, theirs);
  /* A tied round counts for neither side, and — unlike WRPSA v1.0 — is not
     replayed: the round count always advances, tied or not, since a replay
     cannot fit inside exactly RPS_ROUNDS rounds. */
  if (cmp !== 0) d.rpsWins[cmp > 0 ? own : foe]++;
  d.rpsRound++;
  if (rpsOver(d.rpsRound)) {
    const winner = rpsWinner(d.rpsWins);
    d.screen = {
      kind: "rpsover",
      result: winner === "draw" ? "drawn" : winner === own ? "won" : "lost",
      wins: d.rpsWins,
    };
    return;
  }
  /* The next round's opponent card is drawn now, before the player can act
     again — see startDeal's own RPS arm for why. */
  d.rpsCards = [null, null];
  drawRpsFoeCard(d, rng);
  d.phase = "rpsthrow";
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
  const [def] = sooliCandidates(d);
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

function acceptSooli(d: GameState): void {
  d.sooli = true; /* from here on the ace is lowest */
  d.phase = "sooligive";
}

function declineSooli(d: GameState): void {
  const candidates = sooliCandidates(d);
  const i = candidates.findIndex((p) => p === d.sooliSeat);
  d.sooliSeat = i < 0 ? null : (candidates[i + 1] ?? null);
  if (d.sooliSeat !== null) return;
  beginPlay(d);
}

/* Both actors use the same private random return. The RNG cursor belongs to
   the reducer, so replay and StrictMode repeat the identical exchange. */
function giveSooliCard(d: GameState, p: Seat, uid: string, rng: Rng): void {
  const i = d.hands[p].findIndex((c) => c.uid === uid);
  if (i < 0) return;
  const mate = d.hands[partnerOf(p)];
  if (!mate.length) return;
  const give = d.hands[p][i];
  /* Hand layout is local to each peer. Match draws need a UID-ordered copy,
     including duplicate faces; retain the main game's seeded pick order. */
  const pool =
    d.challenge === "race" || d.challenge === "tuppi" || d.challenge === "tupatro"
      ? mate.slice().sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0))
      : mate;
  const get = pick(rng, pool);
  d.hands[p].splice(i, 1);
  mate.splice(
    mate.findIndex((c) => c.uid === get.uid),
    1,
  );
  d.hands[p].push(get);
  if (d.seats[p] === "human") applySort(d, p);
  else sortHand(d, p);
  d.hands[partnerOf(p)] = []; /* the partner sits out */
  /* The declarer leads. The fallback is only reached by a state no
     declaration produced: any seat of the other side will do. */
  const ram = d.ramSeat ?? (((p + 1) % 4) as Seat);
  d.sooliOrder = [ram, partnerOf(ram), p]; /* the sooli player last */
  d.leader = ram;
  d.turn = ram;
  d.sooliExchange = { gave: give, got: get };
  d.phase = "sooliready";
}

/* ============================ tricks ============================ */

/* Ikiliikkuja ("he leaves, but he always comes back with something"): the ♣K's
   effect is *arrival*, not interference. Neither source gives any card an
   effect — the ♣K is an ordinary king, follows suit, beats a queen, loses to
   an ace (lowest in sooli) — so this changes no trick, no suit, no rank, no
   declaration and no score; it only draws one extra temppu for the seat that
   played it. That is what makes it safe to bolt onto a traditional deal at
   all, and why it is gated to Tupatro alone: Traditional Tuppi keeps playing
   the source's game. The draw follows TUPATRO_DRAW's own rule exactly — taken
   whatever the box holds, kept only for a human seat with room — so a full
   box or an AI seat still spends the same randomness it would otherwise
   waste, and what a seat is holding never changes what happens next. */
function playCardInner(d: GameState, p: Seat, uid: string, rng: Rng): void {
  const h = d.hands[p];
  const i = h.findIndex((c) => c.uid === uid);
  if (i < 0) return;
  const [card] = h.splice(i, 1);
  d.trick.push({ p, card });
  if (d.challenge === "tupatro" && isKingOfClubs(card)) {
    for (let di = 0; di < TUPATRO_DRAW; di++) {
      const drawn = pick(rng, CONSUMABLES);
      const e = econOf(d, p);
      if (d.seats[p] === "human" && e.consumables.length < e.consSlots) {
        e.consumables.push(drawn);
        toast(d, { key: "toast.ikiliikkuja", nameKey: drawn.key, p });
      } else if (d.seats[p] === "human") {
        toast(d, { key: "toast.ikiliikkujaFull", p });
      }
    }
  }
  if (d.trick.length === trickSize(d)) d.phase = "resolve";
  else d.turn = nextSeat(d, d.turn);
}

function resolveTrick(d: GameState, rng: Rng): void {
  let w = currentWinner(d);
  if (!w) return;
  const own = ownerSeat(d);
  const ownTeam = teamOf(own);
  /* The theft's target, read from what each side is trying to do in that
     deal rather than from a rule sheet — neither source knows this move. In
     rami the spender's own side takes the trick; in nolo it is pushed onto
     the other side; in sooli a defender pushes it onto the soloist, busting
     the sooli, and the soloist pushes it onto anyone else, since handing it
     to their own sitting-out partner would change nothing. It is the
     *spender's* side now, not the run owner's: a mode with four people
     spending temput cannot keep the single-human shortcut. */
  if (d.stealFor !== null) {
    const spender = d.stealFor;
    const target = d.sooli
      ? spender === d.sooliSeat
        ? d.trick.find((t) => t.p !== spender)
        : d.trick.find((t) => t.p === d.sooliSeat)
      : d.mode === "rami"
        ? d.trick.find((t) => t.p === spender)
        : d.trick.find((t) => !sameTeam(t.p, spender));
    if (target) w = target;
    d.stealFor = null;
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
  /* A traditional deal — Tupatro included, since it shares the same point
     table — scores nothing at all while it is played: its whole worth is the
     trick count, which endHand reads through dealPoints. No scoreTrick, no
     chips into raceBase, no tuppi multiplier and no score pop — there is no
     per-trick number for one to carry. The party support above has already
     been tallied, which is the one thing every mode does. */
  if (d.challenge === "tuppi" || d.challenge === "tupatro") {
    d.phase = "trickend";
    return;
  }
  /* Politiikka scores the parties of a trick's cards under the government of
     the deal just played and the deal's own rami/nolo mode — no scoreTrick,
     no tuppi multiplier, no money and no score pop, the same shape Nami's arm
     below has, since there is no per-trick number in this scale either.
     termOf(d.raceDeal) reads the deal that is *currently* being played (it
     was incremented in startDeal before this trick was ever dealt), so the
     government the trick is scored under is the one the player actually saw
     on GovBox throughout the deal. The toast tells the player why a queen
     just beat an ace — currentWinner already resolved this trick to Sofia
     before the strict `>` comparison ever ran, so it never contradicts the
     winner that was just decided. */
  if (d.challenge === "politiikka") {
    const gov = governmentFor(d.seed, termOf(d.raceDeal));
    d.raceBase[teamOf(w.p)] += puolueTrick(
      gov,
      d.mode,
      cards.map((c) => partyOf(d, c)),
    );
    if (sofiaIn(d.trick)) toast(d, { key: "toast.sofia" });
    d.phase = "trickend";
    return;
  }
  /* Nami scores the cards a trick handed to the winning pair, on the deal's
     own signed table — no scoreTrick, no tuppi multiplier, no money and no
     score pop, since there is no per-trick number in this mode's scale for a
     pop to carry. The value is already the whole answer, so it goes straight
     into raceBase with nothing further applied to it, unlike the race's
     chips × mult. Party support is already tallied above, which every mode
     does. */
  if (d.challenge === "nami" || d.challenge === "namihard") {
    d.raceBase[teamOf(w.p)] += namiTrick(NAMI_VARIANT[d.challenge], cards);
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
  /* In a sooli only the soloist's pair banks — the source's own rule for a
     held sooli, and Tupatro's existing deviation for a busted one, carried
     from the race (see dealScores) into the main run now that the owner's
     pair can be the declaring, non-soloist side. scoresFor's sooli branch is
     team-blind by design (the same seat is out for either team asking), so
     the gate belongs here rather than inside it. */
  if (
    scoresFor(d, ownTeam, w.p) &&
    !d.sooliBust &&
    (!d.sooli || teamOf(d.sooliSeat!) === ownTeam)
  ) {
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
  /* A match never counts down a blind: dealsLeft is inert for a mode with no
      fixed length. handScore is the run owner's pair's awarded deal points.

     One id each, and deliberately not one id-agnostic call: dealScores is the
     race's chips × mult arithmetic and dealPoints is tuppi's point table, and
     the two scales are not convertible. A branch that conflated them would
     bank a five-figure chip score against a target of 52. */
  if (d.challenge === "race" || d.challenge === "tuppi" || d.challenge === "tupatro") {
    const sc = d.challenge === "race" ? dealScores(d) : dealPoints(d);
    /* Traditional tuppi and Tupatro both permit only one pair to be up.
      Korttipeliopas and the Oulun seniorit sheet (Auer, 9 Sep 2022) reset a
      lost lead: returning to the table means 0–0, not points transferred to
      the winning pair. That deal only knocks the leaders down; the next can
      start a new rise. The race deliberately keeps independent cumulative
      scores. */
    if (d.challenge !== "race" && d.raceScores.some((total, t) => total > 0 && sc[t] === 0)) {
      d.raceScores = [0, 0];
      d.handScore = 0;
      return;
    }
    d.raceScores[0] += sc[0];
    d.raceScores[1] += sc[1];
    d.handScore = sc[ownerTeam(d)];
    return;
  }
  /* Nami and Politiikka both bank cumulatively like the race, never
     Traditional Tuppi's "only one pair may be up" reset: that rule is
     tuppi's own, quoted from the sources for a mode that plays tuppi's point
     table, and neither of these plays that table — Politiikka banks the
     parties of the cards captured, not a trick count — or has a declared
     rami to knock down. Nobody declares in Politiikka, so there is no lead to
     knock down, and folding this into the branch above would silently hand
     the mode a reset it was never asked for — the sharpest trap the spec
     names. Both already hold the deal's whole signed value in raceBase —
     resolveTrick put it there with nothing further to apply — so this is the
     same shape as the race and the traditional match above, minus the extra
     arithmetic call. */
  if (d.challenge === "nami" || d.challenge === "namihard" || d.challenge === "politiikka") {
    d.raceScores[0] += d.raceBase[0];
    d.raceScores[1] += d.raceBase[1];
    d.handScore = d.raceBase[ownerTeam(d)];
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
  table?: GameState["seats"],
): GameState {
  const row = CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0];
  const own = ownerSeat(prev);
  /* The table the lobby's chairs picked, whole: any chair may hold a person
     at this screen, a person behind a connection, or the game, so two humans
     can be partners as well as opponents.

     A table naming nobody human is refused here rather than in the type,
     because nextTick would stall on it at the first player-gated phase with no
     error to show for it. The fallback is one human in the chair the parked
     run was played in — entering a challenge must not silently move the player
     back to seat 0 and hand the deal to an AI in their own chair — which is
     also what a challenge dispatched with no table at all gets. */
  const seats = table?.includes("human") ? table : undefined;
  const g: GameState = {
    /* `prev` is the plain state, not the Immer draft, so ownerSeat reads the
       run's real seats. */
    ...createRun(seed, prev.bestAnte, own, seats),
    challenge: row.id,
    runStarted: true,
    menu: null,
    screen: null,
    /* None of the roguelike shell: no money, no jokers, no vouchers, no
       tuppipakka and no boss. createRun already empties the lists and the
       purses are emptied below. Consumables are the one exception, and only
       for "tupatro" — startDeal below is what fills them, a moment after
       this object exists with empty boxes like every other mode's. The
       target is the one field a match keeps — it is the match target, and
       nothing else reads it. It comes off the row as data, so a new mode
       needs no id test here. */
    target: row.target,
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

/* Resumes a saved slot: the main run's own key, or one of the three
   challenge slots. The screen that dispatches this already ran the payload
   through `resumable`, so a save this window cannot act for is never
   offered as a Continue — but the reducer is still this action's authority,
   not the screen, so it rehydrates again rather than trusting the caller.
   A payload that fails to rehydrate here (a version bump landed between the
   click and the dispatch, say) leaves `prev` untouched and silently: there is
   no toast for a Continue that no longer resumes anything, because the
   screen itself would not have drawn one for it.

   `parked` follows exactly the rule startChallenge already gives it: the
   *live* state is what gets parked when the resumed game is a challenge —
   mid-deal included, never the disk copy resumeGame itself just loaded — and
   parked is dropped to null when the resumed game is the roguelike, since
   Continue there is the return trip and there is nothing left behind it. */
function resumeGame(prev: GameState, saved: unknown): GameState {
  const g = rehydrate(saved, prev.bestAnte);
  if (!g) return prev;
  return {
    ...g,
    menu: null,
    parked: g.challenge !== null ? (prev.challenge !== null ? prev.parked : dehydrate(prev)) : null,
  };
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
  /* Only the soloist's pair banks the sooli bonus — the owner's pair can now
     be the side a bot soloed against, and a busted or held sooli against them
     is worth nothing here either. */
  const bonus = d.sooli && d.sooliSeat !== null && teamOf(d.sooliSeat) === ownerTeam(d) ? 6 : over;
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

/* The trick comes out of the acting seat's own box, and its effect acts for
   that seat too — kannanvaihto's declarer, vaihtokauppa's "mine" and
   tikkivarkaus's theft are all `p`'s, not ownerSeat(d)'s. That used to be the
   single-human shortcut the per-seat economy removed everywhere else: Tupatro
   is the mode where four people can spend a temppu, and a trick stolen for
   the run owner while a different seat spent the card would be a lie about
   whose move it was. */
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
    d.revealTo = p;
    toast(d, { key: "toast.peeked", p });
  }
  if (c.id === "tikkivarkaus") {
    d.stealFor = p;
    toast(d, { key: "toast.theftArmed", p });
  }
  if (c.id === "kannanvaihto") {
    if (d.mode === "rami") {
      d.mode = "nolo";
      d.ramSeat = null;
      d.ramTeam = null;
      toast(d, { key: "toast.becameNolo", p });
    } else {
      /* Flipping to rami makes the *spender* the declarer: it is their card
         that buys the change of heart, which in a mode with four people
         spending temput need not be the run owner's. */
      d.mode = "rami";
      d.ramSeat = p;
      d.ramTeam = teamOf(p);
      toast(d, { key: "toast.becameRami", p });
    }
  }
  if (c.id === "vaihtokauppa") {
    const mine = d.hands[p];
    const mate = d.hands[partnerOf(p)];
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
      applySort(d, p);
      sortHand(d, partnerOf(p));
      toast(d, {
        key: "toast.swapped",
        vars: { from: cardName(worst), to: cardName(best) },
        p,
      });
    }
  }
  if (c.id === "uusijako") {
    const dealer = d.dealer;
    dealCards(d, rng, mint);
    d.dealer = dealer;
    d.turn = d.leader;
    toast(d, { key: "toast.redealt", p });
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
      if (d.phase !== "declare" || d.declIdx < 4) return;
      finishDeclare(d);
      return;

    /* --- sooli --- */
    case "acceptSooli":
      if (d.seats[action.p] !== "human") return;
      if (d.phase !== "soolioffer" || action.p !== d.sooliSeat) return;
      acceptSooli(d);
      return;
    case "declineSooli":
      if (d.seats[action.p] !== "human") return;
      if (d.phase !== "soolioffer" || action.p !== d.sooliSeat) return;
      declineSooli(d);
      return;
    case "sooliGive": {
      const p = action.p;
      if (d.seats[p] !== "human") return;
      if (d.phase !== "sooligive" || p !== d.sooliSeat) return;
      giveSooliCard(d, p, action.uid, rng);
      return;
    }
    case "startSooliPlay":
      if (d.seats[action.p] !== "human") return;
      if (d.phase !== "sooliready" || action.p !== d.sooliSeat) return;
      beginPlay(d);
      return;
    case "aiSooli": {
      const p = action.p;
      if (d.seats[p] !== "ai" || p !== d.sooliSeat) return;
      if (d.phase !== action.phase) return;
      if (d.phase === "soolioffer") {
        if (shouldSooli(d, p)) acceptSooli(d);
        else declineSooli(d);
      } else if (d.phase === "sooligive") {
        const card = chooseSooliGive(d, p);
        if (card) giveSooliCard(d, p, card.uid, rng);
      } else if (d.phase === "sooliready") beginPlay(d);
      return;
    }

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
      playCardInner(d, action.p, action.uid, rng);
      return;
    }
    case "aiPlay": {
      if (d.phase !== "play" || d.seats[d.turn] === "human") return;
      const card = chooseAI(d, d.turn, rng);
      playCardInner(d, d.turn, card.uid, rng);
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
      /* A match always opens a screen, match over or not. nextTick's handend
         case returns a tick whenever g.screen is null, and the phase
         deliberately stays handend, so a branch that returned without one
         would fire showHandResult forever. Every match mode ends the same way —
         the difference between them is only what endHand banked. */
      if (
        d.challenge === "race" ||
        d.challenge === "tuppi" ||
        d.challenge === "tupatro" ||
        d.challenge === "nami" ||
        d.challenge === "namihard" ||
        d.challenge === "politiikka"
      ) {
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

    /* --- rock-paper-scissors --- */
    case "revealRps": {
      const p = action.p;
      if (d.seats[p] !== "human") return;
      if (d.phase !== "rpsthrow") return;
      if (p === rpsFoe(d)) return;
      if (d.rpsCards[teamOf(p)] !== null) return;
      /* Identity by uid, never id: this deck holds no duplicate face, but the
         rule does not bend for that. */
      const idx = d.hands[p].findIndex((c) => c.uid === action.uid);
      if (idx === -1) return;
      const [card] = d.hands[p].splice(idx, 1);
      d.rpsCards[teamOf(p)] = card;
      d.phase = "rpsreveal";
      return;
    }
    case "resolveRps":
      if (d.phase !== "rpsreveal") return;
      resolveRps(d, rng);
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
    return {
      ...createRun(action.seed, d.bestAnte, action.seat ?? 0, action.seats),
      runStarted: true,
    };
  /* Both of these replace the whole state, so they sit here rather than in
     apply(), which mutates the draft in place. `original` hands back the base
     state: dehydrate must read plain objects, not Immer drafts. */
  if (action.type === "startChallenge")
    return startChallenge(original(d) ?? d, action.id, action.seed, action.seats);
  if (action.type === "leaveChallenge") return leaveChallenge(original(d) ?? d);
  if (action.type === "resumeGame") return resumeGame(original(d) ?? d, action.saved);
  const rng = makeRng(d.rngState);
  const mint = makeMint(d.uidSeq);
  apply(d, action, rng, mint);
  d.rngState = rng.state;
  d.uidSeq = mint.seq;
  return undefined;
});
