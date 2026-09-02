import { gameReducer } from "./reducer";
import { nextTick } from "./schedule";
import type { Action } from "./actions";
import type { GameState } from "./types";

/* ============================ measuring balance ============================
   The game is driven from decision to decision with no timers and no browser.
   This is the whole measurement apparatus: because timing is data
   (schedule.ts), a run plays out with no browser and nothing to stub.

   Remember: a bot measures the bot. If a mechanic's value lies in a decision,
   the bot has to make that decision or the measurement is worthless — see
   CLAUDE.md. */

/* Run every automatic step until the game is waiting for the player. */
export function advance(state: GameState, limit = 2000): GameState {
  let s = state;
  for (let i = 0; i < limit; i++) {
    const tick = nextTick(s);
    if (!tick) return s;
    s = gameReducer(s, tick.action);
  }
  throw new Error("advance: did not settle — a tick is probably looping");
}

/* Dispatch an action, then run the automatic steps that follow it. */
export function act(state: GameState, action: Action): GameState {
  return advance(gameReducer(state, action));
}

export function actAll(state: GameState, actions: Action[]): GameState {
  return actions.reduce(act, state);
}
