import { cardSellValue } from "../../game/shop";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { PlayingCard } from "../PlayingCard";

export function SideDeckBox() {
  const { sideDeck, sideSlots, phase, swapsLeft } = useGameState();
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
              <button
                className="sell"
                title={t("rail.sell")}
                onClick={() => dispatch({ type: "sellSideCard", index: i })}
              >
                ${cardSellValue(c)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
