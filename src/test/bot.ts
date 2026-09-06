import { act, advance } from "../game/drive";
import { chooseLaydown } from "../game/ai";
import { gameReducer } from "../game/reducer";
import { anySwapAvailable, legalCards, ownerSeat, swapTargets } from "../game/rules";
import { teamOf } from "../game/constants";
import { createRun } from "../game/state";
import { rv } from "../game/cards";
import type { ChallengeId, GameState, Mode, Seat } from "../game/types";

/* The bot plays the game through with no browser and no timers. Used both by
   the determinism tests and for measuring balance.

   Remember: a bot measures the bot. If a mechanic's value lies in a decision,
   the bot has to make that decision — the first side-deck measurement made the
   mechanic look harmful only because the bot swapped blindly and dumped its
   highest card, which is right in nolo and wrong in rami. */
/* Every method is told which seat it is acting for: the state is
   seat-absolute, so a policy that read hands[0] would play somebody else's
   cards the moment the human sat anywhere but seat 0. */
export type Policy = {
  declare: (g: GameState, p: Seat) => Mode;
  /* Returns the uid of the card to play. */
  chooseCard: (g: GameState, p: Seat) => string;
  playSooli: (g: GameState, p: Seat) => boolean;
  /* The card to give away in sooli; the highest by default. */
  sooliGive: (g: GameState, p: Seat) => string;
  /* The tuppipakka swap: the side-deck card to bring in, or null to stop.
     Only a card whose twin is in hand can be brought in, so the policy has to
     look at the hand — a bot that swaps blindly measures nothing. */
  swap: (g: GameState, p: Seat) => string | null;
  /* The laydown: the proposed table as rows of uids, or null to pass. */
  laydown: (g: GameState, p: Seat) => string[][] | null;
};

/* Decides the line before playing: lowest in nolo, highest in rami. */
export const basicPolicy: Policy = {
  declare: (g, p) => (g.hands[p].filter((c) => c.r >= 12).length >= 4 ? "rami" : "nolo"),
  chooseCard: (g, p) => {
    const legal = legalCards(g, p);
    const sorted = legal.slice().sort((a, b) => rv(g, a) - rv(g, b));
    const wantHigh = g.mode === "rami" && !g.sooli;
    return (wantHigh ? sorted[sorted.length - 1] : sorted[0]).uid;
  },
  playSooli: () => false,
  sooliGive: (g, p) => g.hands[p].slice().sort((a, b) => rv(g, b) - rv(g, a))[0].uid,
  /* Takes every enhancement it can: with the twin rule there is no card to
     give up, so a possible swap is never a bad one. */
  swap: (g, p) =>
    g.sideDeck.find((c) => !g.usedSide.includes(c.uid) && swapTargets(g, p, c).length > 0)?.uid ??
    null,
  /* The same greedy search the opponents use. Written down because it is the
     caveat on every challenge measurement: this measures the bot's laydown,
     not the best one — a thinking player who splits and merges combinations
     scores more. */
  laydown: (g, p) => chooseLaydown(g, teamOf(p)),
};

/* Plays from the current phase until some screen opens: the end of a deal,
   the cash-out, or game over. */
export function playToScreen(state: GameState, policy: Policy = basicPolicy): GameState {
  let s = state;
  for (let guard = 0; guard < 2000; guard++) {
    if (s.screen) return s;
    /* Whichever seat the run's human is in. The clock plays every other seat,
       so a phase that is still waiting is waiting for this one. */
    const me = ownerSeat(s);
    switch (s.phase) {
      case "swap": {
        const uid = s.swapsLeft > 0 && anySwapAvailable(s, me) ? policy.swap(s, me) : null;
        if (uid === null) {
          s = act(s, { type: "finishSwap", p: me });
          break;
        }
        const src = s.sideDeck.find((c) => c.uid === uid);
        if (!src || !swapTargets(s, me, src).length)
          throw new Error("policy.swap named a card it cannot swap in");
        s = act(s, { type: "pickSideCard", p: me, uid });
        break;
      }
      case "declare":
        s = act(s, { type: "declare", p: me, decl: policy.declare(s, me) });
        break;
      case "soolioffer":
        s = act(
          s,
          policy.playSooli(s, me)
            ? { type: "acceptSooli", p: me }
            : { type: "declineSooli", p: me },
        );
        break;
      case "sooligive":
        s = act(s, { type: "sooliGive", p: me, uid: policy.sooliGive(s, me) });
        break;
      case "sooliready":
        s = act(s, { type: "startSooliPlay", p: me });
        break;
      case "play":
        if (s.turn !== me) throw new Error("play phase stalled on an opponent's turn");
        s = act(s, { type: "playCard", p: me, uid: policy.chooseCard(s, me) });
        break;
      default:
        throw new Error(`bot has no move for phase ${s.phase}`);
    }
  }
  throw new Error("playToScreen did not settle");
}

/* Plays a blind from the start of its first deal. */
export function playBlind(state: GameState, policy: Policy = basicPolicy): GameState {
  return playToScreen(advance(gameReducer(state, { type: "startBlind" })), policy);
}

/* Plays blinds until the run ends or the limit is reached. Also returns each
   deal's score, so balance can be measured. */
/* Forty blinds: ten antes of four, so a run that clears them all is not cut
   short by the limit. */
export function playRun(seed: string, policy: Policy = basicPolicy, maxBlinds = 40) {
  let s = createRun(seed);
  const deals: number[] = [];

  for (let i = 0; i < maxBlinds; i++) {
    s = playBlind(s, policy);

    /* From the end of a deal, carry on to the next until the blind resolves. */
    while (s.screen?.kind === "dealend") {
      deals.push(s.screen.score);
      s = playToScreen(advance(gameReducer(s, { type: "nextDeal" })), policy);
    }

    if (s.screen?.kind === "cashout") {
      deals.push(s.screen.score);
      s = advance(gameReducer(s, { type: "toShop" }));
      s = advance(gameReducer(s, { type: "nextBlind" }));
      if (s.screen?.kind === "victory") return { state: s, deals, outcome: "victory" as const };
      continue;
    }
    if (s.screen?.kind === "gameover") return { state: s, deals, outcome: "gameover" as const };
  }
  return { state: s, deals, outcome: "limit" as const };
}

/* ============================ challenges ============================
   A challenge run skips the whole roguelike flow — no startBlind, no toShop,
   no nextBlind — so it needs a loop of its own rather than an extension of
   playToScreen, whose switch has no move for the laydown and whose callers
   walk the ante ladder. */
export function playChallenge(
  seed: string,
  policy: Policy = basicPolicy,
  id: ChallengeId = "rummikub",
) {
  let s = advance(gameReducer(createRun(seed), { type: "startChallenge", id, seed }));
  const deals: number[] = [];

  for (let guard = 0; guard < 4000; guard++) {
    if (s.screen?.kind === "challengeover") {
      deals.push(s.handScore);
      return { state: s, deals, score: s.screen.score };
    }
    if (s.screen?.kind === "dealend") {
      deals.push(s.screen.score);
      s = act(s, { type: "nextDeal" });
      continue;
    }
    if (s.screen) throw new Error(`a challenge opened ${s.screen.kind}`);
    const me = ownerSeat(s);
    if (s.phase === "play") {
      if (s.turn !== me) throw new Error("play phase stalled on an opponent's turn");
      s = act(s, { type: "playCard", p: me, uid: policy.chooseCard(s, me) });
      continue;
    }
    if (s.phase === "laydown") {
      if (s.layTurn !== teamOf(me)) throw new Error("laydown stalled on the opponents' turn");
      const combos = policy.laydown(s, me);
      const turn = s.layNo;
      s = act(s, combos ? { type: "layCards", p: me, combos } : { type: "passLaydown", p: me });
      /* A rejected lay toasts and leaves the turn where it was, which would
         loop forever. Fail loudly instead: the policy proposed something the
         rule refuses. */
      if (s.phase === "laydown" && s.layNo === turn)
        throw new Error("policy.laydown proposed a table validateLay rejects");
      continue;
    }
    throw new Error(`bot has no move for phase ${s.phase}`);
  }
  throw new Error("playChallenge did not settle");
}
