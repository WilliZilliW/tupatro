import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useDispatch } from "./useGame";
import type { Card } from "../game/types";

/* Dragging your hand into order. While a drag is in flight the order is local
   state, and reorderHand is dispatched only at the end — otherwise every
   pointermove would run the whole reducer.

   Suppressing the click uses no timer: the click that follows pointerup
   consumes the moved flag. That keeps setTimeout to a single call site
   (useGameLoop). */
export function useHandDrag(hand: Card[]) {
  const dispatch = useDispatch();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const active = useRef<string | null>(null);
  const startX = useRef(0);
  const moved = useRef(false);

  const cards = order ? order.flatMap((u) => hand.filter((c) => c.uid === u)) : hand;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, uid: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    active.current = uid;
    moved.current = false;
    startX.current = e.clientX;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture is not required; the drag works without it */
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>, uid: string) {
    if (active.current !== uid) return;
    if (!moved.current && Math.abs(e.clientX - startX.current) < 8) return;
    moved.current = true;
    setDragging(uid);

    const row = rowRef.current;
    if (!row) return;
    const current = order ?? hand.map((c) => c.uid);
    const without = current.filter((u) => u !== uid);

    /* The first neighbour whose midpoint is to the right of the pointer. */
    let insertAt = without.length;
    for (const el of Array.from(row.querySelectorAll<HTMLElement>("[data-uid]"))) {
      const u = el.dataset.uid;
      if (!u || u === uid) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) {
        insertAt = without.indexOf(u);
        break;
      }
    }
    const next = without.slice();
    next.splice(insertAt, 0, uid);
    if (next.join(",") !== current.join(",")) setOrder(next);
  }

  function finish(uid: string) {
    if (active.current !== uid) return;
    active.current = null;
    setDragging(null);
    if (moved.current && order) dispatch({ type: "reorderHand", uids: order });
    setOrder(null);
  }

  /* Consumes the drag flag: the click right after a drag does not play the
     card, but the next one does. */
  function wasDragged(): boolean {
    if (!moved.current) return false;
    moved.current = false;
    return true;
  }

  const handlers = (uid: string) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => onPointerDown(e, uid),
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => onPointerMove(e, uid),
    onPointerUp: () => finish(uid),
    onPointerCancel: () => finish(uid),
  });

  return { rowRef, cards, dragging, handlers, wasDragged };
}
