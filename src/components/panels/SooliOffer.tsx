import { sooliRisk } from "../../game/ai";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Rich } from "../Rich";

export function SooliOffer() {
  const g = useGameState();
  const dispatch = useDispatch();
  const you = useViewSeat();
  const { t, fmt, seatName } = useI18n();

  const risk = sooliRisk(g, you);

  return (
    <>
      <h3>{t("sooli.title")}</h3>
      <p>
        <Rich text={t("sooli.body", { who: seatName(g.ramSeat ?? 0, you) })} />
      </p>
      <div className="ln">
        <span>{t("sooli.onSuccess")}</span>
        <b>{t("sooli.onSuccessVal")}</b>
      </div>
      <div className="ln">
        <span>{t("sooli.onFail")}</span>
        <b>{t("sooli.onFailVal")}</b>
      </div>
      <div className="ln">
        <span>{t("sooli.highCards")}</span>
        <b>{risk.high}</b>
      </div>
      <div className="ln">
        <span>{t("sooli.lowGuards")}</span>
        <b>{risk.lowGuards}/4</b>
      </div>
      <div className="ln">
        <span>{t("sooli.verdict")}</span>
        <b>{t(risk.verdictKey as Parameters<typeof t>[0])}</b>
      </div>
      {/* One number, two meanings: in the main game g.target is the blind's
          target and in a race it is the match target, so the label has to
          follow the mode. A race has no blind at all, and a panel that said
          "blind target" would name a thing the deal is not being played for. */}
      <div className="ln">
        <span>{t(g.challenge === "race" ? "sooli.raceTarget" : "sooli.target")}</span>
        <b>{fmt(g.target)}</b>
      </div>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "acceptSooli", p: you })}>
          {t("btn.playSooli")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "declineSooli", p: you })}>
          {t("btn.playNormally")}
        </button>
      </div>
    </>
  );
}
