import { useEffect, useRef, type Dispatch } from "react";
import { teamOf } from "../game/constants";
import { LAYDOWN_TURN_MS, POP_MS, TOAST_MS, nextTick } from "../game/schedule";
import { useViewSeat } from "./useSeat";
import type { Action } from "../game/actions";
import type { GameState } from "../game/types";

/* The game's clock. The only place in the whole project that calls
   setTimeout.

   The effect's cleanup is what makes a pending timer safe: when the step
   changes or the component unmounts, the timer cancels itself, so a new run can
   never be caught by a timer left over from the last one.

   The effect depends on the step's key alone, not on the whole state —
   otherwise rearranging your hand would reset an opponent's turn timer. */
export function useGameLoop(state: GameState, dispatch: Dispatch<Action>): void {
  const you = useViewSeat();
  const tick = nextTick(state);
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const key = tick?.key ?? "";

  useEffect(() => {
    const t = tickRef.current;
    if (!t) return;
    const id = window.setTimeout(() => dispatch(t.action), t.delay);
    return () => window.clearTimeout(id);
  }, [key, dispatch]);

  const toastId = state.toast?.id ?? 0;
  useEffect(() => {
    if (!toastId) return;
    const id = window.setTimeout(() => dispatch({ type: "dismissToast", id: toastId }), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toastId, dispatch]);

  const hasPop = state.pop !== null;
  useEffect(() => {
    if (!hasPop) return;
    const id = window.setTimeout(() => dispatch({ type: "clearPop" }), POP_MS);
    return () => window.clearTimeout(id);
  }, [hasPop, dispatch]);

  /* The laydown's 60 seconds. This is the one piece of timing in the project
     that is not data: a tick for the player's own turn would make drive.ts
     auto-pass for a bot that has a move, and every headless measurement of the
     mode would measure nothing. It is a limit on a human's thinking instead,
     so it lives here.

     The dependency is the turn's number, not the state: placing a card
     mid-turn must not hand the player another minute.

     It stops while the menu or a modal is up, for the same reason nextTick
     returns null under the menu: both are full-screen overlays, so the panel
     cannot be reached, and a turn spent behind one is spent on a decision the
     player was not allowed to make. The rules of the laydown are read in the
     rules modal, which is exactly where the minute used to run out. */
  const layOpen = state.phase === "laydown" && state.layTurn === teamOf(you);
  const layTurnNo = layOpen && state.menu === null && state.modal === null ? state.layNo : -1;
  useEffect(() => {
    if (layTurnNo < 0) return;
    const id = window.setTimeout(() => dispatch({ type: "passLaydown", p: you }), LAYDOWN_TURN_MS);
    return () => window.clearTimeout(id);
  }, [layTurnNo, you, dispatch]);
}
