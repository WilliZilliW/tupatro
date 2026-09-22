import { useState } from "react";
import { RPS_ROUNDS } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { ownerTeam } from "../../game/rules";
import { rehydrate, resumable } from "../../game/save";
import {
  readChallengeRun,
  readChallengeScores,
  readRaceScores,
  readRpsScores,
  readRun,
} from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";
import type { Challenge, ChallengeId, GameState } from "../../game/types";

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
   door. Each row now also reads its own save the same way, through
   readChallengeRun / resumable, so a Continue can never lead somewhere the
   slot does not.

   SCORES is here rather than on the menu because the board it opens is the
   solo roguelike's own: ScoresModal draws readScores() and nothing else, the
   top ten on tupatro-scores-v1, which no session ever writes to. It sits in
   the footer beside Back on purpose — everything above it starts a game, and
   this one only reads one. */
export function SinglePlayer() {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t } = useI18n();
  const { runStarted, challenge, seats, parked, bestAnte } = g;
  const solo = challenge === null && seats.filter((s) => s === "human").length === 1;

  /* Three branches, in precedence: the game you are already in (closeMenu),
     the roguelike parked behind a challenge (leaveChallenge then closeMenu —
     leaveChallenge raises the menu again on its way past), and only then the
     slot on disk. Parked wins over disk because it is at least as fresh: it
     was taken at the click that opened the challenge, where the disk copy is
     only as recent as the last screen boundary. */
  let mainOnClick: (() => void) | null = null;
  let mainSaved: GameState | null = null;
  if (runStarted) {
    if (solo) {
      mainOnClick = () => dispatch({ type: "closeMenu" });
      mainSaved = g;
    } else if (parked !== null) {
      mainOnClick = () => {
        dispatch({ type: "leaveChallenge" });
        dispatch({ type: "closeMenu" });
      };
      mainSaved = rehydrate(parked, bestAnte);
    } else {
      const raw = readRun();
      const resumed = resumable(raw, null, bestAnte);
      if (resumed) {
        mainOnClick = () => dispatch({ type: "resumeGame", saved: raw });
        mainSaved = resumed;
      }
    }
  }

  return (
    <Overlay>
      <h2>{t("single.title")}</h2>
      <p className="dek">{t("single.dek")}</p>
      {/* The roguelike has a name, and it is the game's own: Tupatro. The
          match mode that used to carry it in the list below is Multiplayer
          Tupatro now, so the two can be told apart on the one screen that
          does not draw it. */}
      <h3 className="singlerunhead">{t("single.run")}</h3>
      <div className="singlerun">
        {mainOnClick && mainSaved && (
          <p className="dek chalpos">{t("single.savedRun", { ante: mainSaved.ante })}</p>
        )}
        {mainOnClick && (
          <MoveButton className="btn" onClick={mainOnClick}>
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
      </div>
      <h3 className="singlemodes">{t("single.modes")}</h3>
      <ul className="challist">
        {SOLO_MODES.map((c) => (
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

/* Tupatro is the one CHALLENGES row this screen does not draw, and the reason
   is mechanical rather than editorial: only a "human" seat draws a temppu and
   no bot ever spends one, so a solo board would deal the player four draws a
   deal against three opponents holding none. It was asked for as a multiplayer
   mode and it stays one — LOBBY_MODES in Lobby.tsx is the list that carries
   it, and these two lists are deliberately not the same list. Teaching chooseAI
   to spend a temppu is what would earn it a row here. */
const SOLO_MODES = CHALLENGES.filter((c) => c.id !== "tupatro");

/* One row. Its Continue is drawn either for the game this window is already
   in (g.challenge === row.id) or for a slot resumable() accepts on disk;
   whichever it is, the position line and the Continue's own dispatch read
   the same state, so the row can never describe a game other than the one
   the click leads to. Play asks first whenever there is a game to lose —
   the in-row confirmation, rather than a MoveButton alone, because a live
   table cannot reach this row at all (the door upstairs is shut while a
   session is live), so the MoveButton here is defence in depth exactly as it
   was before this row could have anything to lose. */
function ChallengeRow({ row }: { row: Challenge }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, nameOf, descOf } = useI18n();
  const [asking, setAsking] = useState<ChallengeId | null>(null);

  const inThisGame = g.challenge === row.id;
  const raw = inThisGame ? null : readChallengeRun(row.id);
  const saved: GameState | null = inThisGame ? g : resumable(raw, row.id, g.bestAnte);
  const canContinue = saved !== null;

  const continueGame = () => {
    if (inThisGame) dispatch({ type: "closeMenu" });
    else dispatch({ type: "resumeGame", saved: raw });
  };

  /* The confirmation replaces the row's buttons in place, never the row
     around them: the name, description, position and best-result lines stay
     put, so the click that led here is still on screen. */
  return (
    <li className="chalrow">
      <span className="chalglyph">{row.g}</span>
      <div className="chaltext">
        <h3>{nameOf(row)}</h3>
        <p className="dek">{descOf(row)}</p>
        {saved && <PositionLine row={row} state={saved} />}
        <BestLine row={row} />
      </div>
      {asking === row.id ? (
        <div className="chalask">
          <p className="dek">{t("single.replaceAsk", { name: nameOf(row) })}</p>
          <div className="row">
            <MoveButton
              className="btn"
              onClick={() => {
                setAsking(null);
                dispatch({ type: "startChallenge", id: row.id });
              }}
            >
              {t("btn.yesRestart")}
            </MoveButton>
            <button className="btn ghost" onClick={() => setAsking(null)}>
              {t("btn.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="chalbtns">
          {canContinue && (
            <MoveButton className="btn" onClick={continueGame}>
              {t("btn.continue")}
            </MoveButton>
          )}
          <MoveButton
            className="btn"
            onClick={() =>
              canContinue ? setAsking(row.id) : dispatch({ type: "startChallenge", id: row.id })
            }
          >
            {t("btn.play")}
          </MoveButton>
        </div>
      )}
    </li>
  );
}

/* The one line saying where a saved game is, read from exactly the state its
   own Continue would resume — never a second, independent read of the same
   slot, which is how the line could end up describing a different game from
   the one the click leads to. Tuppi-Rummikub's own running total is left
   out on purpose: it is a negative-going laydown number that means nothing
   out of context, unlike a deal reached or a match's two totals. */
function PositionLine({ row, state }: { row: Challenge; state: GameState }) {
  const { t, fmt } = useI18n();
  if (row.id === "rummikub") {
    return (
      <p className="dek chalpos">
        {t("single.savedDeals", {
          deal: fmt(state.deals - state.dealsLeft),
          deals: fmt(row.deals),
        })}
      </p>
    );
  }
  if (row.id === "rps") {
    const own = ownerTeam(state);
    return (
      <p className="dek chalpos">
        {t("single.savedRps", {
          us: fmt(state.rpsWins[own]),
          them: fmt(state.rpsWins[1 - own]),
          round: fmt(Math.min(state.rpsRound + 1, RPS_ROUNDS)),
          total: fmt(RPS_ROUNDS),
        })}
      </p>
    );
  }
  const own = ownerTeam(state);
  return (
    <p className="dek chalpos">
      {t("single.savedMatch", {
        deal: fmt(state.raceDeal),
        us: fmt(state.raceScores[own]),
        them: fmt(state.raceScores[1 - own]),
      })}
    </p>
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
  if (row.id === "rps") {
    /* The best row is the board's own first, and the board sorts won before
       drawn before lost — so a line is only drawn for a match that was
       actually won, exactly as the match modes' own line is. */
    const best = readRpsScores()[0];
    return (
      <p className="dek">
        {best?.result === "won"
          ? t("rps.bestWon", { wins: fmt(best.wins), losses: fmt(best.losses) })
          : t("challenges.noBest")}
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
