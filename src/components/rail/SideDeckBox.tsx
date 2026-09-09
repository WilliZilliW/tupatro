import { econOf } from "../../game/economy";
import { cardSellValue } from "../../game/shop";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { PlayingCard } from "../PlayingCard";

/* The cards are drawn on any window; the sell button is a MoveButton, because
   `sellSideCard` is a `seat` action and a shared table holds no seat. */
export function SideDeckBox() {
  const g = useGameState();
  const you = useViewSeat();
  const { sideDeck, sideSlots, swapsLeft } = econOf(g, you);
  const { phase } = g;
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <div>
      <div className="lbl" style={{ marginBottom: 5 }}>
        {t("rail.sideDeck")} {sideDeck.length}/{sideSlots}
        {phase === "swap" && " · " + t("rail.swapsLeft", { n: swapsLeft })}
      </div>
      {sideDeck.length === 0 ? (
        <div className="empty">{t("rail.noSideDeck")}</div>
      ) : (
        <div className="sidelist">
          {sideDeck.map((c, i) => (
            <div key={c.uid} className="sideitem">
              <PlayingCard card={c} className="mini" twin />
              <MoveButton
                className="sell"
                title={t("rail.sell")}
                onClick={() => dispatch({ type: "sellSideCard", p: you, index: i })}
              >
                ${cardSellValue(c)}
              </MoveButton>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
