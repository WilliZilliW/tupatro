import { cardName } from "../../game/cards";
import { sooliRisk } from "../../game/ai";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { PlayingCard } from "../PlayingCard";

export function SooliReady() {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, seatName } = useI18n();

  const ex = g.sooliExchange;
  if (!ex) return null;
  const risk = sooliRisk(g);

  return (
    <>
      <h3>{t("sooliDone.title")}</h3>
      <div className="sidedeck">
        <PlayingCard card={ex.gave} className="mini" />
        <div style={{ alignSelf: "center", fontFamily: "var(--font-m)", color: "#8FA89A" }}>→</div>
        <PlayingCard card={ex.got} className="mini" />
      </div>
      <div className="ln">
        <span>{t("sooliDone.gave")}</span>
        <b>{cardName(ex.gave)}</b>
      </div>
      <div className="ln">
        <span>{t("sooliDone.got")}</span>
        <b>{cardName(ex.got)}</b>
      </div>
      <div className="ln">
        <span>{t("sooliDone.verdict")}</span>
        <b>{t(risk.verdictKey as Parameters<typeof t>[0])}</b>
      </div>
      <p className="fine">{t("sooliDone.fine", { leader: seatName(g.ramSeat ?? 0) })}</p>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "startSooliPlay" })}>
          {t("sooliDone.start")}
        </button>
      </div>
    </>
  );
}
