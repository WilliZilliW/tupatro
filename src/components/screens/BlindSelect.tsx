import { ANTES, BLIND_KEYS, BLIND_MARKS, BLIND_MULT, BLIND_REWARD } from "../../game/constants";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";
import { cx } from "../cx";

export function BlindSelect() {
  const { ante, blindIdx, beaten } = useGameState();
  const dispatch = useDispatch();
  const { t, fmt } = useI18n();

  return (
    <Overlay>
      <h2>{t("blindSelect.title", { ante, name: t(BLIND_KEYS[blindIdx]) })}</h2>
      <p className="dek">{t("blindSelect.intro")}</p>
      <div className="blinds">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cx("bcard", i === blindIdx ? "now" : beaten[i] && "done")}>
            <div className={`blindmark bm-${i}`}>{BLIND_MARKS[i]}</div>
            <h3>{t(BLIND_KEYS[i])}</h3>
            <div className="req">{fmt(Math.round(ANTES[ante - 1] * BLIND_MULT[i]))}</div>
            <div className="rw">{t("blindSelect.reward", { amount: "$" + BLIND_REWARD[i] })}</div>
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "startBlind" })}>
          {t("btn.deal")}
        </button>
        {blindIdx < 2 && (
          <button className="btn ghost" onClick={() => dispatch({ type: "skipBlind" })}>
            {t("btn.skip")}
          </button>
        )}
        <button
          className="btn ghost"
          onClick={() => dispatch({ type: "openModal", modal: "rules" })}
        >
          {t("btn.rules")}
        </button>
        <ScoresButton />
      </div>
    </Overlay>
  );
}
