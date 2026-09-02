import { jokerSellValue } from "../../game/shop";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

export function JokerList() {
  const { jokers, jokerSlots } = useGameState();
  const dispatch = useDispatch();
  const { t, nameOf, descOf } = useI18n();

  return (
    <div>
      <div className="lbl">
        {t("rail.jokers")} {jokers.length}/{jokerSlots}
      </div>
      <div className="jokers">
        {jokers.length === 0 && <div className="empty">{t("rail.noJokers")}</div>}
        {jokers.map((j, i) => (
          <div key={j.id} className={`jk r-${j.r}`}>
            <div className="glyph">{j.g}</div>
            <div>
              <div className="nm">
                {nameOf(j)}
                {j.mode && <span className={`tag ${j.mode}`}>{j.mode.toUpperCase()}</span>}
              </div>
              <div className="tx">{descOf(j)}</div>
            </div>
            <button
              className="sell"
              title={t("rail.sell")}
              onClick={() => dispatch({ type: "sellJoker", index: i })}
            >
              ${jokerSellValue(j)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
