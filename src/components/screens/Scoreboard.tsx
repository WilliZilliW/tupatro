import { BLIND_KEYS } from "../../game/constants";
import { useI18n } from "../../i18n/useI18n";
import type { ScoreRow } from "../../game/scores";

/* Rows in, markup out: the board is read from the store by whoever renders
   this, so the component itself knows nothing about the browser. The seed is a
   column of its own because it is what makes a past run replayable — the seed
   dialog takes it straight. */
export function Scoreboard({ rows }: { rows: ScoreRow[] }) {
  const { t, fmt } = useI18n();

  return (
    <div className="scoreboard">
      <h3>{t("score.title")}</h3>
      {rows.length === 0 ? (
        <p className="dek">{t("score.empty")}</p>
      ) : (
        <div className="scoretable">
          <div className="scorehead">
            <span>{t("score.rank")}</span>
            <span>{t("seed.label")}</span>
            <span>{t("over.ante")}</span>
            <span>{t("score.blind")}</span>
            <span>{t("score.points")}</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div className="scorerow" key={`${row.seed}-${row.at}-${i}`}>
              <span className="srank">{i + 1}</span>
              <span className="sseed">{row.seed}</span>
              <span className="sante">{`${row.ante}/8`}</span>
              {/* A hand-edited store can carry any number, and an end screen
                  that threw would be worse than a board with an odd row. */}
              <span className="sblind">{t(BLIND_KEYS[row.blindIdx] ?? BLIND_KEYS[0])}</span>
              <span className="spts">{fmt(row.runScore)}</span>
              <span className={row.won ? "sres won" : "sres"}>
                {row.won ? t("score.won") : t("score.lost")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
