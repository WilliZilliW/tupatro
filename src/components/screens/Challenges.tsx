import { useState } from "react";
import { CHALLENGES } from "../../game/content";
import { readChallengeScores, readRaceScores } from "../../game/storage";
import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import type { Challenge } from "../../game/types";

const PLAYER_COUNTS = [1, 2, 3, 4] as const;

/* The list of alternate rule sets. Like the two end screens, this reads the
   board while it renders — a challenge's best score is not part of GameState —
   and it reads it through game/storage.ts, which is the one door. */
export function Challenges() {
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("challenges.title")}</h2>
      <ul className="challist">
        {CHALLENGES.map((c) => (
          <ChallengeRow key={c.id} row={c} />
        ))}
      </ul>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "showMenu", view: "start" })}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}

/* One row, and its own component because the race's player count is
   component-local state: it is a choice made on the click and never part of a
   run, so it belongs in neither GameState nor the save. */
function ChallengeRow({ row }: { row: Challenge }) {
  const dispatch = useDispatch();
  const { t, fmt, nameOf, descOf } = useI18n();
  const race = row.id === "race";
  const [humans, setHumans] = useState<1 | 2 | 3 | 4>(1);

  /* Two boards, two shapes, and each row reads only its own: a race can be
     lost and reports the deals it took, a challenge reports a score. A board
     whose best row is a loss reads as no result yet — the line is about a
     match won. */
  const raceBest = race ? readRaceScores()[0] : undefined;
  const chalBest = race ? undefined : readChallengeScores(row.id)[0];
  const line = race
    ? raceBest?.won
      ? t("race.bestWon", { deals: fmt(raceBest.deals) })
      : t("challenges.noBest")
    : chalBest
      ? t("challenges.best", { score: fmt(chalBest.score) })
      : t("challenges.noBest");

  return (
    <li className="chalrow">
      <span className="chalglyph">{row.g}</span>
      <div className="chaltext">
        <h3>{nameOf(row)}</h3>
        <p className="dek">{descOf(row)}</p>
        <p className="dek">{line}</p>
        {race && (
          <div className="dek chalplayers">
            <span>{t("race.players")}</span>{" "}
            {PLAYER_COUNTS.map((n) => (
              <button
                key={n}
                className={n === humans ? "tinybtn on" : "tinybtn"}
                onClick={() => setHumans(n)}
              >
                {fmt(n)}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        className="btn"
        onClick={() =>
          dispatch(
            race
              ? { type: "startChallenge", id: row.id, humans }
              : { type: "startChallenge", id: row.id },
          )
        }
      >
        {t("btn.play")}
      </button>
    </li>
  );
}
