import { useEffect } from "react";
import { ownerSeat } from "../game/rules";
import { waitingSeat } from "../game/schedule";
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

   Four rules, in this order, and the order is the whole of it.

   0. **The shared table is not seated at all**, so nothing is written and the
      felt does not swing round between turns. It has to come first: a table's
      `netSeat` is null exactly as an offline window's is, so without the flag
      rule 2 would follow the hot seat and rotate a board four people are
      watching from one side of the room.
   1. **A session's chair wins outright.** The host assigned it, so it is a
      fact about this window rather than a guess — and it must come first,
      because rule 2 is actively wrong once the players are on different
      machines: following the seat the game is waiting on would swing every
      peer's window round to whoever is to play, show them that player's hand,
      and have their panels dispatch for a seat they do not own. This is the
      per-window seat the hot-seat rule below says transport owes it.
   2. **Hot seat**, when there is no session and more than one human is on the
      board: follow `waitingSeat(g)`, the seat the game is waiting on. It has
      to, and the reason is mechanical rather than cosmetic — the panels
      dispatch for `useViewSeat()` and the reducer refuses an action for a
      seat whose turn it is not, so without this the match stalls in silence
      with no error. It comes ahead of the "already human" early return: with
      two humans the window can be looking at a human seat and still the wrong
      one. One screen, one seat at a time, so a hot-seat match runs on the
      honour system.
   3. **The repair**, which is what this hook was built for and makes no choice
      at all: a window looking at a seat that is not "human" is looking at an
      impossible value, and the seat the run is played from is the answer.

   All three live here rather than anywhere else because two writers of the
   viewing seat would have to stay in step with each other. The transport is
   given no setter; it hands its seat *in*.

   No timer. `useGameLoop` stays the only setTimeout call site in the project;
   this is a plain effect syncing local view state to the state of record. */
export function useSeatSync(g: GameState, netSeat: Seat | null = null, isTable = false): void {
  const you = useViewSeat();
  const setSeat = useSetViewSeat();
  const seats = g.seats;
  const humans = seats.filter((k) => k === "human").length;
  const waiting = waitingSeat(g);

  useEffect(() => {
    if (isTable) return;
    if (netSeat !== null) {
      if (netSeat !== you) setSeat(netSeat);
      return;
    }
    /* Null means the game is waiting for nobody — an automatic phase, a
       screen, the menu — and the seat then stays where it is rather than
       jumping about between steps. */
    if (humans > 1 && waiting !== null) {
      if (waiting !== you) setSeat(waiting);
      return;
    }
    if (seats[you] === "human") return;
    /* An all-AI board has no seat to move to, and moving to seat 0 anyway
       would be a guess. */
    if (!seats.includes("human")) return;
    setSeat(ownerSeat({ seats }));
  }, [seats, you, setSeat, netSeat, humans, waiting, isTable]);
}
