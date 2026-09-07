import { useEffect } from "react";
import { ownerSeat } from "../game/rules";
import { useSetViewSeat, useViewSeat } from "./useSeat";
import type { GameState } from "../game/types";

/* The one writer of the viewing seat.

   Why it exists: `g.seats` is saved and the viewing seat is not — it is a
   property of the window, so it cannot be. A save written by the seat-picker
   build can seat the human at 1, 2 or 3, and resuming it would leave the
   window looking at seat 0, a seat marked "ai": every panel would dispatch for
   a seat the reducer refuses to act for, every guard would refuse, and the
   deal would never advance. The seat the run is actually played from is the
   only correct answer, and it is in the state. It is needed in the other
   direction too: New Game from such a window dispatches a bare `newRun`, which
   seats the player back at 0, and the window has to follow.

   It fires only when the window is looking at a seat that is not "human", so
   nothing it does is a choice — it repairs an impossible value and otherwise
   leaves the context alone. That is why every seat move goes through `newRun`
   and lets this follow rather than calling the setter itself: two writers would
   need to stay in step, and the resume case needs this one regardless.

   It is a single-human heuristic: with two humans on one board `ownerSeat` is
   the wrong answer for at least one window, so the transport increment has to
   replace it with a per-window choice.

   No timer. `useGameLoop` stays the only setTimeout call site in the project;
   this is a plain effect syncing local view state to the state of record. */
export function useSeatSync(g: GameState): void {
  const you = useViewSeat();
  const setSeat = useSetViewSeat();
  const seats = g.seats;

  useEffect(() => {
    if (seats[you] === "human") return;
    /* An all-AI board has no seat to move to, and moving to seat 0 anyway
       would be a guess. */
    if (!seats.includes("human")) return;
    setSeat(ownerSeat({ seats }));
  }, [seats, you, setSeat]);
}
