import { handPower } from "../../game/ai";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Rich } from "../Rich";

/* The declaration: rami or nolo. Hand strength first — that is what the
   decision is made from. */
export function DeclarePanel() {
  const g = useGameState();
  const dispatch = useDispatch();
  const you = useViewSeat();
  const { t, seatName } = useI18n();

  const forcedRami = g.boss?.id === "pakkorami";
  const forcedNolo = g.boss?.id === "pakkonolo";
  const prev = g.declSeq.slice(0, g.declIdx);
  const already = prev.some((p) => g.shows[p]?.decl === "rami");
  const power = handPower(g, you);

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
      {(forcedRami || forcedNolo) && (
        <p className="warn" style={{ marginTop: 8 }}>
          {t(forcedRami ? "declare.forcedRami" : "declare.forcedNolo")}
        </p>
      )}
      <p className="fine">
        <Rich text={t("declare.fine")} />
      </p>
      <div className="row">
        <button
          className="btn"
          disabled={forcedNolo}
          onClick={() => dispatch({ type: "declare", p: you, decl: "rami" })}
        >
          {t("btn.showRami")}
        </button>
        <button
          className="btn blue"
          disabled={forcedRami}
          onClick={() => dispatch({ type: "declare", p: you, decl: "nolo" })}
        >
          {t("btn.showNolo")}
        </button>
      </div>
    </>
  );
}
