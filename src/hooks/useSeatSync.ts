import { useEffect } from "react";
import { ownerSeat } from "../game/rules";
import { waitingSeat } from "../game/schedule";
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

   With more than one human on the board — the race mode's hot seat — it does
   make a choice: it follows `waitingSeat(g)`, the seat the game is waiting on.
   It has to, and the reason is mechanical rather than cosmetic: the panels
   dispatch for `useViewSeat()` and the reducer refuses an action for a seat
   whose turn it is not, so without this the match stalls in silence with no
   error. That clause comes **first**, ahead of the "already human" early
   return: with two humans the window can be looking at a human seat and still
   at the wrong one.

   It is still not a per-window choice, and that is the limitation. One screen,
   one seat at a time: whoever is at the device sees the hand of whoever is to
   play, so a hot-seat match runs on the honour system. **Transport has to
   replace this with a per-window seat**, which is the first thing the
   transport increment owes.

   No timer. `useGameLoop` stays the only setTimeout call site in the project;
   this is a plain effect syncing local view state to the state of record. */
export function useSeatSync(g: GameState): void {
  const you = useViewSeat();
  const setSeat = useSetViewSeat();
  const seats = g.seats;
  const humans = seats.filter((k) => k === "human").length;
  const waiting = waitingSeat(g);

  useEffect(() => {
    /* Hot seat. Null means the game is waiting for nobody — an automatic
       phase, a screen, the menu — and the seat then stays where it is rather
       than jumping about between steps. */
    if (humans > 1 && waiting !== null) {
      if (waiting !== you) setSeat(waiting);
      return;
    }
    if (seats[you] === "human") return;
    /* An all-AI board has no seat to move to, and moving to seat 0 anyway
       would be a guess. */
    if (!seats.includes("human")) return;
    setSeat(ownerSeat({ seats }));
  }, [seats, you, setSeat, humans, waiting]);
}
