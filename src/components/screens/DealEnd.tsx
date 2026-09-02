import { tuppiInfo } from "../../game/scoring";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { Rich } from "../Rich";

export function DealEnd({ score }: { score: number }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, fmt } = useI18n();
  const info = tuppiInfo(g);

  const why = g.sooliBust
    ? t("why.sooliBust")
    : g.mode === "rami" && g.usTricks < 7
      ? t("why.ramiShort", { won: g.usTricks })
      : g.mode === "nolo" && g.usTricks > 6
        ? t("why.noloBust", { won: g.usTricks })
        : t("why.tricks", { us: g.usTricks, them: g.themTricks, mult: info.mult });

  return (
    <Overlay>
      <h2>{t(score > 0 ? "dealEnd.scored" : "dealEnd.wasted")}</h2>
      <p className="dek">{why}</p>
      <div className="cashline">
        <span>{t("dealEnd.thisDeal")}</span>
        <b>{fmt(score)}</b>
      </div>
      <div className="cashline">
        <span>{t("dealEnd.blindScore")}</span>
        <b>
          {fmt(g.blindScore)} / {fmt(g.target)}
        </b>
      </div>
      <div className="cashline">
        <span>{t("dealEnd.dealsLeft")}</span>
        <b>{g.dealsLeft}</b>
      </div>
      <p className="dek" style={{ marginTop: 14 }}>
        <Rich text={t("dealEnd.missing", { n: fmt(g.target - g.blindScore) })} />
      </p>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "nextDeal" })}>
          {t("btn.nextDeal")}
        </button>
      </div>
    </Overlay>
  );
}
