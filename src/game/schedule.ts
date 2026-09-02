import type { Action } from "./actions";
import type { GameState } from "./types";

/* ============================ timing ============================
   The game advances by itself in several places: opponents declare and play,
   tricks resolve, hands end. Timing is stated as data rather than as calls:
   nextTick reports which action to dispatch and when, and React's effect
   cleanup cancels the timer when the state changes. Cancellation is therefore
   not a separate concern.

   `key` identifies the step. The effect depends on that alone, so rearranging
   your hand does not reset an opponent's turn timer. */

export type Tick = { key: string; action: Action; delay: number };

export function nextTick(g: GameState): Tick | null {
  switch (g.phase) {
    case "declare":
      if (g.declIdx >= 4)
        return { key: "declare:done", action: { type: "finishDeclare" }, delay: 0 };
      /* The player's own declaration is a decision, not a timer. */
      if (g.declSeq[g.declIdx] === 0) return null;
      return { key: `declare:${g.declIdx}`, action: { type: "aiDeclare" }, delay: 620 };

    case "play":
      if (g.turn === 0) return null;
      return {
        key: `play:${g.trickNo}:${g.trick.length}`,
        action: { type: "aiPlay" },
        delay: g.trick.length === 0 ? 700 : 560,
      };

    case "resolve":
      return { key: `resolve:${g.trickNo}`, action: { type: "resolveTrick" }, delay: 760 };

    case "trickend":
      /* A scored trick lingers, so the breakdown can be read. */
      return {
        key: `trickend:${g.trickNo}`,
        action: { type: "endTrick" },
        delay: g.pop ? 1250 : 650,
      };

    case "handend":
      /* The result is already on screen: the phase deliberately stays handend
         until the player continues, so the step is done — do not repeat it. */
      if (g.screen) return null;
      return {
        key: `handend:${g.dealsLeft}`,
        action: { type: "showHandResult" },
        delay: 500,
      };

    default:
      return null;
  }
}

export const TOAST_MS = 2500;
export const POP_MS = 1600;
