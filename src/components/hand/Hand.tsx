import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { legalCards } from "../../game/rules";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useHandDrag } from "../../hooks/useHandDrag";
import { PlayingCard } from "../PlayingCard";
import { cx } from "../cx";
import { HandTools } from "./HandTools";
import { Hint } from "./Hint";
import type { Card } from "../../game/types";

/* During the declaration round and the swaps the cards are spread, so the
   whole hand is visible at once. A new phase belongs in this set and in
   Hint. */
const SPREAD_PHASES = new Set(["declare", "soolioffer", "swap", "sooligive"]);

export function Hand() {
  const g = useGameState();
  const dispatch = useDispatch();
  const hand = g.hands[0];
  const { rowRef, cards, dragging, handlers, wasDragged } = useHandDrag(hand);

  /* Green marks the follow-suit obligation. The swap phase has nothing to
     mark: the tuppipakka card replaces its own twin, so the hand is read
     during the swap, never clicked. */
  const legal =
    g.phase === "play" && g.turn === 0 ? new Set(legalCards(g, 0).map((c) => c.uid)) : null;
  const shownUid = g.shows[0]?.card?.uid ?? null;

  /* An illegal card is not left without feedback: the reducer explains the
     follow-suit obligation with a toast, so the tap is worth dispatching as
     it is. */
  const act = (c: Card) => {
    if (wasDragged()) return;
    if (g.phase === "sooligive") return dispatch({ type: "sooliGive", uid: c.uid });
    if (g.phase !== "play") return;
    dispatch({ type: "playCard", p: 0, uid: c.uid });
  };

  const onKeyDown = (e: ReactKeyboardEvent, c: Card) => {
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      dispatch({ type: "moveCard", uid: c.uid, dir: e.key === "ArrowLeft" ? -1 : 1 });
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      act(c);
    }
  };

  return (
    <div className="handzone">
      <HandTools />
      <div ref={rowRef} className={cx("handrow", SPREAD_PHASES.has(g.phase) && "spread")}>
        {cards.map((c) => {
          const ok = legal !== null && legal.has(c.uid);
          return (
            <PlayingCard
              key={c.uid}
              card={c}
              data-uid={c.uid}
              tabIndex={0}
              className={cx(
                "hcard",
                ok && "playable",
                legal && !ok && "dead",
                c.uid === shownUid && "shown",
                dragging === c.uid && "dragging",
              )}
              onClick={() => act(c)}
              onKeyDown={(e) => onKeyDown(e, c)}
              {...handlers(c.uid)}
            />
          );
        })}
      </div>
      <Hint />
    </div>
  );
}
