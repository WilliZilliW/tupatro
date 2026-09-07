import { useState } from "react";
import { cardName, enhOf } from "../../game/cards";
import { econOf } from "../../game/economy";
import { canSwapIn, swapTargets } from "../../game/rules";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { PlayingCard } from "../PlayingCard";
import { cx } from "../cx";

/* The side deck: swap cards into hand before the declaration. The cards come
   before the prose, because the decision is made from them.

   A click selects rather than swaps: the exchange itself is forced — the card
   in hand is the selected card's own twin — but what the enhancement does,
   which card it upgrades and why a dimmed card cannot be taken are all worth
   reading first, and a misclick needs a way back. The selection is a uid in
   component-local state, never in GameState: it must not survive the phase and
   must not be in the save. */
export function SwapPanel() {
  const g = useGameState();
  const dispatch = useDispatch();
  const you = useViewSeat();
  const { sideDeck, usedSide, swapsLeft, swaps } = econOf(g, you);
  const { t, nameOf, descOf } = useI18n();
  const [selUid, setSelUid] = useState<string | null>(null);

  /* A uid that has left the tuppipakka reads as no selection, so nothing has
     to reconcile the two. */
  const sel = sideDeck.find((c) => c.uid === selUid) ?? null;
  const enh = sel && enhOf(sel);
  const target = sel ? swapTargets(g, you, sel)[0] : undefined;

  /* Why the selected card cannot be swapped, in the reducer's own guard order
     (spent, then swaps left, then the twin) so the panel and the rule never
     give two different reasons for the same card. */
  function unavailable(): string | null {
    if (!sel) return null;
    if (usedSide.includes(sel.uid)) return t("swap.unavailUsed");
    if (swapsLeft <= 0) return t("swap.unavailNoSwaps");
    if (!canSwapIn(g, you, sel)) return t("swap.unavailNoMatch", { card: cardName(sel) });
    return null;
  }
  const why = unavailable();

  return (
    <>
      <h3>{t("swap.title")}</h3>
      <div className="sidedeck">
        {sideDeck.map((c) => (
          <PlayingCard
            key={c.uid}
            card={c}
            twin
            data-uid={c.uid}
            className={cx(
              "mini",
              "sidecard",
              usedSide.includes(c.uid) && "used",
              /* Dimmed rather than hidden: not being dealt the twin is
                 information about the deal, and the card is still yours. Both
                 dimmed states stay selectable — the explanation is worth most
                 exactly where the card cannot be taken. */
              !usedSide.includes(c.uid) && !canSwapIn(g, you, c) && "nomatch",
              c.uid === selUid && "selected",
            )}
            onClick={() => setSelUid((u) => (u === c.uid ? null : c.uid))}
          />
        ))}
      </div>
      {sel && (
        <div className="swapinfo">
          <div className="swapcards">
            <PlayingCard card={sel} twin className="mini" data-uid={sel.uid} />
            {target && (
              <>
                <span className="swaparrow">→</span>
                <PlayingCard card={target} className="mini" data-uid={target.uid} />
              </>
            )}
          </div>
          <div className="ln">
            <span>{t("swap.selected")}</span>
            <b>{enh ? nameOf(enh) : cardName(sel)}</b>
          </div>
          {enh && <p>{descOf(enh)}</p>}
          {target && <p className="fine">{t("swap.replaces", { card: cardName(target) })}</p>}
          {why && <p className="swapwhy">{why}</p>}
        </div>
      )}
      <div className="ln">
        <span>{t("swap.pickSide")}</span>
        <b>{t("swap.count", { left: swapsLeft, total: swaps })}</b>
      </div>
      <p className="fine">{t("swap.fine")}</p>
      <div className="row">
        {sel ? (
          <>
            <button
              className="btn"
              disabled={!!why}
              onClick={() => {
                dispatch({ type: "pickSideCard", p: you, uid: sel.uid });
                setSelUid(null);
              }}
            >
              {t("btn.doSwap")}
            </button>
            <button className="btn ghost" onClick={() => setSelUid(null)}>
              {t("btn.cancel")}
            </button>
          </>
        ) : (
          <button className="btn" onClick={() => dispatch({ type: "finishSwap", p: you })}>
            {t("btn.toDeclaration")}
          </button>
        )}
      </div>
    </>
  );
}
