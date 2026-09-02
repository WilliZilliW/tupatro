import { tuppiInfo } from "../../game/scoring";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

export function GameOver() {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, fmt } = useI18n();
  const info = tuppiInfo(g);

  const why = g.sooliBust
    ? t("over.sooliBust")
    : g.mode === "rami" && g.usTricks < 7
      ? t("over.ramiShort", { won: g.usTricks })
      : g.mode === "nolo" && g.usTricks > 6
        ? t("over.noloBust", { won: g.usTricks })
        : t("over.thin", { mult: info.mult });

  const lines: Array<[string, string]> = [
    [t("over.ante"), `${g.ante}/8`],
    [t("over.tricks"), `${g.usTricks}–${g.themTricks}`],
    [t("over.best"), String(Math.max(g.bestAnte, g.ante))],
    [t("seed.label"), g.seed],
  ];

  return (
    <Overlay>
      <h2>{t("over.title")}</h2>
      <p className="dek">
        {t("over.summary", { score: fmt(g.blindScore), target: fmt(g.target) })} {why}{" "}
        {t("over.allDealsPlayed", { deals: g.deals })}
      </p>
      {lines.map(([label, value]) => (
        <div className="cashline" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn" onClick={() => dispatch({ type: "newRun" })}>
          {t("btn.newGame")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "newRun", seed: g.seed })}>
          {t("btn.replaySeed")}
        </button>
        <button
          className="btn ghost"
          onClick={() => dispatch({ type: "openModal", modal: "rules" })}
        >
          {t("btn.rules")}
        </button>
      </div>
    </Overlay>
  );
}
