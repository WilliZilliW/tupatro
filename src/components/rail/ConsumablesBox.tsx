import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

export function ConsumablesBox() {
  const { consumables, consSlots } = useGameState();
  const dispatch = useDispatch();
  const { t, nameOf, descOf } = useI18n();

  return (
    <div>
      <div className="lbl" style={{ marginBottom: 5 }}>
        {t("rail.tricksHeader")} {consumables.length}/{consSlots}
      </div>
      {consumables.length === 0 ? (
        <div className="empty">{t("rail.noTricks")}</div>
      ) : (
        <div className="cons">
          {consumables.map((c, i) => (
            <button
              key={c.id + i}
              className="consbtn"
              onClick={() => dispatch({ type: "useConsumable", index: i })}
            >
              <div className="nm">{nameOf(c)}</div>
              <div className="tx">{descOf(c)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
