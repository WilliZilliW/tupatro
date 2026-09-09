import { CHALLENGES } from "../../game/content";
import { readChallengeScores } from "../../game/storage";
import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import type { Challenge } from "../../game/types";

/* The list of alternate rule sets, and what it lists is the ones started from
   here: both match modes are started from the lobby, whose chairs say who
   plays, so they are filtered out rather than dropped from CHALLENGES —
   startChallenge still reads their rows' `deals` and `target`.

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
        {CHALLENGES.filter((c) => c.id !== "race" && c.id !== "tuppi").map((c) => (
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
   board Tuppi-Rummikub has always been played on — and a MoveButton because
   `startChallenge` is a `flow` action, not because a live table can get here:
   the one door to this list is Menu's Challenges button, which is
   `disabled={net.live}` on a host, a guest and a table alike, so no session
   reaches this screen at all. It is defence in depth: with it, that one
   `disabled` is not the only thing holding the line, and the table's sweep
   sets `menu: "challenges"` directly rather than clicking through. Enabling
   the door would take more than a flag — ChallengePlate still names the two
   sides through `chal.us` and `chal.them`, which is a point of view a shared
   screen does not have. */
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
      <MoveButton className="btn" onClick={() => dispatch({ type: "startChallenge", id: row.id })}>
        {t("btn.play")}
      </MoveButton>
    </li>
  );
}
