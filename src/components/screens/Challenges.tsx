import { CHALLENGES } from "../../game/content";
import { readChallengeScores } from "../../game/storage";
import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import type { Challenge } from "../../game/types";

/* The list of alternate rule sets, and what it lists is the ones started from
   here: the race is started from the lobby, whose chairs say who plays, so it
   is filtered out rather than dropped from CHALLENGES — startChallenge still
   reads the race row's `deals`.

   Like the two end screens, this reads the board while it renders — a
   challenge's best score is not part of GameState — and it reads it through
   game/storage.ts, which is the one door. */
export function Challenges() {
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("challenges.title")}</h2>
      <ul className="challist">
        {CHALLENGES.filter((c) => c.id !== "race").map((c) => (
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

/* One row. Dispatched with no seat table at all, which is the single-human
   board Tuppi-Rummikub has always been played on. */
function ChallengeRow({ row }: { row: Challenge }) {
  const dispatch = useDispatch();
  const { t, fmt, nameOf, descOf } = useI18n();
  const best = readChallengeScores(row.id)[0];

  return (
    <li className="chalrow">
      <span className="chalglyph">{row.g}</span>
      <div className="chaltext">
        <h3>{nameOf(row)}</h3>
        <p className="dek">{descOf(row)}</p>
        <p className="dek">
          {best ? t("challenges.best", { score: fmt(best.score) }) : t("challenges.noBest")}
        </p>
      </div>
      <button className="btn" onClick={() => dispatch({ type: "startChallenge", id: row.id })}>
        {t("btn.play")}
      </button>
    </li>
  );
}
