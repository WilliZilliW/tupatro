import { handPower } from "../../game/ai";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

/* The declaration: rami or nolo. Hand strength first — that is what the
   decision is made from. */
export function DeclarePanel() {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, seatName } = useI18n();

  const forced = g.boss?.id === "pakkorami";
  const prev = g.declSeq.slice(0, g.declIdx);
  const already = prev.some((p) => g.shows[p]?.decl === "rami");
  const power = handPower(g, 0);

  return (
    <>
      <h3>{t("declare.title")}</h3>
      <div className="ln">
        <span>{t("declare.power")}</span>
        <b>
          {power}
          {t(power >= 9 ? "declare.powerGood" : "declare.powerWeak")}
        </b>
      </div>
      {prev.length > 0 && (
        <div className="ln">
          <span>{t("declare.alreadyShown")}</span>
          <b>{prev.map((p) => `${seatName(p)} ${g.shows[p]?.decl ?? ""}`).join(" · ")}</b>
        </div>
      )}
      {already && (
        <p className="warn" style={{ marginTop: 8 }}>
          {t("declare.ramiAlready")}
        </p>
      )}
      {forced && (
        <p className="warn" style={{ marginTop: 8 }}>
          {t("declare.forced")}
        </p>
      )}
      <p className="fine">{t("declare.fine")}</p>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "declare", decl: "rami" })}>
          {t("btn.showRami")}
        </button>
        <button
          className="btn blue"
          disabled={forced}
          onClick={() => dispatch({ type: "declare", decl: "nolo" })}
        >
          {t("btn.showNolo")}
        </button>
      </div>
    </>
  );
}
