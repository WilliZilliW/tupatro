import { useEffect } from "react";
import { ownerSeat } from "../game/rules";
import { useSetViewSeat, useViewSeat } from "./useSeat";
import type { GameState, Seat } from "../game/types";

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

   With two humans on one board `ownerSeat` is the wrong answer for at least
   one window, so a session hands in the chair the host assigned and that wins
   outright — a fact, where the branch below is only a repair. It is still the
   one writer of the viewing seat: giving the transport a setter of its own
   would mean two writers to keep in step, and the resume case needs this one
   regardless.

   No timer. `useGameLoop` stays the only setTimeout call site in the project;
   this is a plain effect syncing local view state to the state of record. */
export function useSeatSync(g: GameState, netSeat: Seat | null = null): void {
  const you = useViewSeat();
  const setSeat = useSetViewSeat();
  const seats = g.seats;

  useEffect(() => {
    if (netSeat !== null) {
      if (netSeat !== you) setSeat(netSeat);
      return;
    }
    if (seats[you] === "human") return;
    /* An all-AI board has no seat to move to, and moving to seat 0 anyway
       would be a guess. */
    if (!seats.includes("human")) return;
    setSeat(ownerSeat({ seats }));
  }, [seats, you, setSeat, netSeat]);
}
