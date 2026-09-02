import { useEffect, useRef, type Dispatch } from "react";
import { POP_MS, TOAST_MS, nextTick } from "../game/schedule";
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
}
