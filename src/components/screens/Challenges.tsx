import { CHALLENGES } from "../../game/content";
import { readChallengeScores } from "../../game/storage";
import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

/* The list of alternate rule sets. Like the two end screens, this reads the
   board while it renders — a challenge's best score is not part of GameState —
   and it reads it through game/storage.ts, which is the one door. */
export function Challenges() {
  const dispatch = useDispatch();
  const { t, fmt, nameOf, descOf } = useI18n();

  return (
    <Overlay>
      <h2>{t("challenges.title")}</h2>
      <ul className="challist">
        {CHALLENGES.map((c) => {
          const best = readChallengeScores(c.id)[0];
          return (
            <li className="chalrow" key={c.id}>
              <span className="chalglyph">{c.g}</span>
              <div className="chaltext">
                <h3>{nameOf(c)}</h3>
                <p className="dek">{descOf(c)}</p>
                <p className="dek">
                  {best ? t("challenges.best", { score: fmt(best.score) }) : t("challenges.noBest")}
                </p>
              </div>
              <button
                className="btn"
                onClick={() => dispatch({ type: "startChallenge", id: c.id })}
              >
                {t("btn.play")}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "showMenu", view: "start" })}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}
