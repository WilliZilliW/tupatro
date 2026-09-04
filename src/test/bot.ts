import { act, advance } from "../game/drive";
import { gameReducer } from "../game/reducer";
import { anySwapAvailable, legalCards, swapTargets } from "../game/rules";
import { createRun } from "../game/state";
import { rv } from "../game/cards";
import type { GameState, Mode } from "../game/types";

/* The bot plays the game through with no browser and no timers. Used both by
   the determinism tests and for measuring balance.

   Remember: a bot measures the bot. If a mechanic's value lies in a decision,
   the bot has to make that decision — the first side-deck measurement made the
   mechanic look harmful only because the bot swapped blindly and dumped its
   highest card, which is right in nolo and wrong in rami. */
export type Policy = {
  declare: (g: GameState) => Mode;
  /* Returns the uid of the card to play. */
  chooseCard: (g: GameState) => string;
  playSooli: (g: GameState) => boolean;
  /* The card to give away in sooli; the highest by default. */
  sooliGive: (g: GameState) => string;
  /* The tuppipakka swap: the side-deck card to bring in, or null to stop.
     Only a card whose twin is in hand can be brought in, so the policy has to
     look at the hand — a bot that swaps blindly measures nothing. */
  swap: (g: GameState) => string | null;
};

/* Decides the line before playing: lowest in nolo, highest in rami. */
export const basicPolicy: Policy = {
  declare: (g) => (g.hands[0].filter((c) => c.r >= 12).length >= 4 ? "rami" : "nolo"),
  chooseCard: (g) => {
    const legal = legalCards(g, 0);
    const sorted = legal.slice().sort((a, b) => rv(g, a) - rv(g, b));
    const wantHigh = g.mode === "rami" && !g.sooli;
    return (wantHigh ? sorted[sorted.length - 1] : sorted[0]).uid;
  },
  playSooli: () => false,
  sooliGive: (g) => g.hands[0].slice().sort((a, b) => rv(g, b) - rv(g, a))[0].uid,
  /* Takes every enhancement it can: with the twin rule there is no card to
     give up, so a possible swap is never a bad one. */
  swap: (g) =>
    g.sideDeck.find((c) => !g.usedSide.includes(c.uid) && swapTargets(g, c).length > 0)?.uid ??
    null,
};

/* Plays from the current phase until some screen opens: the end of a deal,
   the cash-out, or game over. */
export function playToScreen(state: GameState, policy: Policy = basicPolicy): GameState {
  let s = state;
  for (let guard = 0; guard < 2000; guard++) {
    if (s.screen) return s;
    switch (s.phase) {
      case "swap": {
        const uid = s.swapsLeft > 0 && anySwapAvailable(s) ? policy.swap(s) : null;
        if (uid === null) {
          s = act(s, { type: "finishSwap" });
          break;
        }
        const src = s.sideDeck.find((c) => c.uid === uid);
        if (!src || !swapTargets(s, src).length)
          throw new Error("policy.swap named a card it cannot swap in");
        s = act(s, { type: "pickSideCard", uid });
        break;
      }
      case "declare":
        s = act(s, { type: "declare", decl: policy.declare(s) });
        break;
      case "soolioffer":
        s = act(s, policy.playSooli(s) ? { type: "acceptSooli" } : { type: "declineSooli" });
        break;
      case "sooligive":
        s = act(s, { type: "sooliGive", uid: policy.sooliGive(s) });
        break;
      case "sooliready":
        s = act(s, { type: "startSooliPlay" });
        break;
      case "play":
        if (s.turn !== 0) throw new Error("play phase stalled on an opponent's turn");
        s = act(s, { type: "playCard", p: 0, uid: policy.chooseCard(s) });
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
export function playRun(seed: string, policy: Policy = basicPolicy, maxBlinds = 24) {
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
