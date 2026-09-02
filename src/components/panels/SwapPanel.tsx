import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { PlayingCard } from "../PlayingCard";
import { cx } from "../cx";

/* The side deck: swap cards into hand before the declaration. The cards come
   before the prose, because the decision is made from them. */
export function SwapPanel() {
  const { sideDeck, swapPick, usedSide, swapsLeft, swaps } = useGameState();
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <>
      <h3>{t("swap.title")}</h3>
      <div className="sidedeck">
        {sideDeck.map((c) => (
          <PlayingCard
            key={c.uid}
            card={c}
            className={cx(
              "mini",
              "sidecard",
              swapPick?.uid === c.uid && "picked",
              usedSide.includes(c.uid) && "used",
            )}
            onClick={() => dispatch({ type: "pickSideCard", uid: c.uid })}
          />
        ))}
      </div>
      <div className="ln">
        <span>{t(swapPick ? "swap.pickHand" : "swap.pickSide")}</span>
        <b>{t("swap.count", { left: swapsLeft, total: swaps })}</b>
      </div>
      <p className="fine">{t("swap.fine")}</p>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "finishSwap" })}>
          {t("btn.toDeclaration")}
        </button>
        {swapPick && (
          <button className="btn ghost" onClick={() => dispatch({ type: "cancelSidePick" })}>
            {t("btn.cancelPick")}
          </button>
        )}
      </div>
    </>
  );
}
