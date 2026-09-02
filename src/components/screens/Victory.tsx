import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

export function Victory() {
  const { money, jokers, seed } = useGameState();
  const dispatch = useDispatch();
  const { t, nameOf } = useI18n();

  return (
    <Overlay>
      <h2>{t("win.title")}</h2>
      <p className="dek">{t("win.body")}</p>
      <div className="cashline">
        <span>{t("cash.bank")}</span>
        <b>${money}</b>
      </div>
      <div className="cashline">
        <span>{t("win.jokers")}</span>
        <b>{jokers.map((j) => nameOf(j)).join(", ") || "–"}</b>
      </div>
      <div className="cashline">
        <span>{t("seed.label")}</span>
        <b>{seed}</b>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn gold" onClick={() => dispatch({ type: "newRun" })}>
          {t("btn.newGame")}
        </button>
      </div>
    </Overlay>
  );
}
