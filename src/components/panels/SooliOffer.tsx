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
  /* The traditional match scores a sooli by tuppi's own table — 24 points to
     the soloist's pair if it holds, 24 to the declarers if it busts — and has
     no multiplier at all, so the two value lines say a different thing there.
     The race and the main game share the multiplier and are unchanged. */
  const points = g.challenge === "tuppi";

  return (
    <>
      <h3>{t("sooli.title")}</h3>
      <p>
        <Rich text={t("sooli.body", { who: seatName(g.ramSeat ?? 0, you) })} />
      </p>
      <div className="ln">
        <span>{t("sooli.onSuccess")}</span>
        <b>{t(points ? "sooli.onSuccessValPoints" : "sooli.onSuccessVal")}</b>
      </div>
      <div className="ln">
        <span>{t("sooli.onFail")}</span>
        <b>{t(points ? "sooli.onFailValPoints" : "sooli.onFailVal")}</b>
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
          target and in either match mode it is the match target, so the label
          has to follow the mode. A match has no blind at all, and a panel that
          said "blind target" would name a thing the deal is not being played
          for. */}
      <div className="ln">
        <span>
          {t(
            g.challenge === "race" || g.challenge === "tuppi"
              ? "sooli.matchTarget"
              : "sooli.target",
          )}
        </span>
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
