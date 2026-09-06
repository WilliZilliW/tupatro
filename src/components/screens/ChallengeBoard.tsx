import { useI18n } from "../../i18n/useI18n";
import type { ChallengeRow } from "../../game/scores";

/* Rows in, markup out, exactly like Scoreboard — and a separate component
   rather than a mode of that one, because the row shape is different: a
   challenge has no ante and no blind to report. */
export function ChallengeBoard({ rows }: { rows: ChallengeRow[] }) {
  const { t, fmt } = useI18n();

  return (
    <div className="scoreboard">
      <h3>{t("chalScore.title")}</h3>
      {rows.length === 0 ? (
        <p className="dek">{t("score.empty")}</p>
      ) : (
        <div className="scoretable chaltable">
          <div className="scorehead">
            <span>{t("score.rank")}</span>
            <span>{t("seed.label")}</span>
            <span>{t("score.points")}</span>
          </div>
          {rows.map((row, i) => (
            <div className="scorerow" key={`${row.seed}-${row.at}-${i}`}>
              <span className="srank">{i + 1}</span>
              <span className="sseed">{row.seed}</span>
              <span className="spts">{fmt(row.score)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
