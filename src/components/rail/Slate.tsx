import { finalScore, tuppiInfo } from "../../game/scoring";
import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";

export function Slate() {
  const g = useGameState();
  const { t, fmt } = useI18n();

  const info = tuppiInfo(g);
  const sc = finalScore(g);
  /* The deal's score is added to blindScore only when the deal ends — do not
     count it twice. */
  const live = g.phase === "declare" || g.phase === "play" || g.phase === "resolve";
  const tot = g.blindScore + (live ? sc : 0);
  const pct = Math.min(100, g.target ? (tot / g.target) * 100 : 0);

  return (
    <div className="slate">
      <div className="lbl">{t("rail.blindScore")}</div>
      <div className="scorebig">{fmt(tot)}</div>
      <div className="scoresub">
        {t("rail.target")} {fmt(g.target)}
      </div>
      <div className={cx("bar", g.target && tot >= g.target && "done")}>
        <i style={{ width: pct + "%" }} />
      </div>
      <div className="formula">
        <span className="lbl" style={{ letterSpacing: ".1em" }}>
          {t("rail.thisDeal")}
        </span>
        <span className="pill c">{fmt(g.base)}</span>
        <span className={cx("pill", info.mult ? "t" : "dead")}>×{info.mult}</span>
        <span className="times">=</span>
        <span className={cx("pill", sc ? "t" : "dead")}>{fmt(sc)}</span>
      </div>
      {g.mode && (
        <div className={cx("needline", info.ok ? "ok" : "warn")}>
          {t(info.need.key as Parameters<typeof t>[0], info.need.vars)}
        </div>
      )}
    </div>
  );
}
