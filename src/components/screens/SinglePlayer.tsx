import { CHALLENGES } from "../../game/content";
import { readChallengeScores, readRaceScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";
import type { Challenge } from "../../game/types";

/* Everything played against nobody but the game: the roguelike and all three
   alternate rule sets. The start menu's Single player door is what raises it,
   and that door is disabled while a session is live and refuses in its own
   handler too, which is why nothing on this screen knows the network exists —
   no session can reach it, so there is no session state to draw and no line to
   explain.

   Every mode here is dispatched with no seat table at all, which is the
   single-human board `createRun` and `startChallenge` build from the owner's
   own chair. The multi-human form of the two match modes is the lobby's, and
   the chairs there are what say who plays.

   Like the two end screens, the rows read a board while they render — a best
   result is not part of GameState — through game/storage.ts, which is the one
   door.

   SCORES is here rather than on the menu because the board it opens is the
   solo roguelike's own: ScoresModal draws readScores() and nothing else, the
   top ten on tupatro-scores-v1, which no session ever writes to. It sits in
   the footer beside Back on purpose — everything above it starts a game, and
   this one only reads one. */
export function SinglePlayer() {
  const { runStarted, challenge, seats, parked } = useGameState();
  const dispatch = useDispatch();
  const { t } = useI18n();
  /* Continue means the solo roguelike, wherever it is. Behind a challenge it
     is `parked`, so the click leaves the challenge first and then lowers the
     menu — leaveChallenge raises the menu again on its way past. A challenge
     entered with nothing parked has no run to go home to, and a Continue
     leading to a fresh one would be the new-run button wearing the wrong
     label. */
  const solo = challenge === null && seats.filter((s) => s === "human").length === 1;
  const canContinue = runStarted && (solo || parked !== null);

  return (
    <Overlay>
      <h2>{t("single.title")}</h2>
      <p className="dek">{t("single.dek")}</p>
      <div className="singlerun">
        {canContinue && (
          <MoveButton
            className="btn"
            onClick={() => {
              if (parked !== null) dispatch({ type: "leaveChallenge" });
              dispatch({ type: "closeMenu" });
            }}
          >
            {t("btn.continue")}
          </MoveButton>
        )}
        {/* The confirmation belongs to the destructive click, and this is it:
            newRun replaces the whole state, the parked run included, so a run
            already under way is asked about first. With nothing to lose there
            is nothing to confirm. */}
        <MoveButton
          className="btn"
          onClick={() =>
            dispatch(runStarted ? { type: "openModal", modal: "restart" } : { type: "newRun" })
          }
        >
          {t("btn.newGame")}
        </MoveButton>
        <p className="dek">{t("single.runDek")}</p>
      </div>
      <h3 className="singlemodes">{t("single.modes")}</h3>
      <ul className="challist">
        {CHALLENGES.map((c) => (
          <ChallengeRow key={c.id} row={c} />
        ))}
      </ul>
      <div className="row singlefoot">
        <button className="btn" onClick={() => dispatch({ type: "showMenu", view: "start" })}>
          {t("btn.back")}
        </button>
        <ScoresButton />
      </div>
    </Overlay>
  );
}

/* One row. A MoveButton because `startChallenge` is a `flow` action, not
   because a live table can reach this list — the door upstairs is shut while a
   session is live — so it is defence in depth exactly as it was on the
   challenges list this screen grew out of. */
function ChallengeRow({ row }: { row: Challenge }) {
  const dispatch = useDispatch();
  const { t, nameOf, descOf } = useI18n();

  return (
    <li className="chalrow">
      <span className="chalglyph">{row.g}</span>
      <div className="chaltext">
        <h3>{nameOf(row)}</h3>
        <p className="dek">{descOf(row)}</p>
        <BestLine row={row} />
      </div>
      <MoveButton className="btn" onClick={() => dispatch({ type: "startChallenge", id: row.id })}>
        {t("btn.play")}
      </MoveButton>
    </li>
  );
}

/* Which board a row reads follows its id, not the screen it is drawn on, and
   that is not cosmetic: a match files its result on its own key
   (tupatro-race-v1 / tupatro-tuppi-v1), so readChallengeScores("race") reads
   the empty tupatro-challenge-race-v1 and would report "no result yet" for
   every match ever won.

   Two board shapes, two lines. A match can be lost, so its row reports the
   deals a win took and says nothing about a loss; a challenge has only a
   score. */
function BestLine({ row }: { row: Challenge }) {
  const { t, fmt } = useI18n();
  if (row.id === "rummikub") {
    const best = readChallengeScores(row.id)[0];
    return (
      <p className="dek">
        {best ? t("challenges.best", { score: fmt(best.score) }) : t("challenges.noBest")}
      </p>
    );
  }
  const best = readRaceScores(row.id)[0];
  return (
    <p className="dek">
      {best?.won ? t("race.bestWon", { deals: fmt(best.deals) }) : t("challenges.noBest")}
    </p>
  );
}
