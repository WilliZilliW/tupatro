import { canSwapIn } from "../../game/rules";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { PlayingCard } from "../PlayingCard";
import { cx } from "../cx";

/* The side deck: swap cards into hand before the declaration. The cards come
   before the prose, because the decision is made from them. One click is the
   whole swap — the card in hand it replaces is its own twin, never a choice. */
export function SwapPanel() {
  const g = useGameState();
  const { sideDeck, usedSide, swapsLeft, swaps } = g;
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
            twin
            className={cx(
              "mini",
              "sidecard",
              usedSide.includes(c.uid) && "used",
              /* Dimmed rather than hidden: not being dealt the twin is
                 information about the deal, and the card is still yours. */
              !usedSide.includes(c.uid) && !canSwapIn(g, c) && "nomatch",
            )}
            onClick={() => dispatch({ type: "pickSideCard", uid: c.uid })}
          />
        ))}
      </div>
      <div className="ln">
        <span>{t("swap.pickSide")}</span>
        <b>{t("swap.count", { left: swapsLeft, total: swaps })}</b>
      </div>
      <p className="fine">{t("swap.fine")}</p>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "finishSwap" })}>
          {t("btn.toDeclaration")}
        </button>
      </div>
    </>
  );
}
