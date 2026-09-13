import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { LOCALE_NAMES } from "../../i18n";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";

/* Continue belongs to the solo roguelike, so it is disabled while a session is
  live: resuming a run the room has not started is the same window walking out
  of the session it is still in. New game is not disabled and dispatches no
  run — it opens the lobby, which is where every game is configured now, and
  the lobby's own Start is what refuses the roguelike while a peer is
  connected. The menu asks nothing about who you are playing with, so Join a
  game sits beside it rather than behind a Multiplayer door.

  Continue reaches the solo run wherever it is. Behind a challenge it is
  `parked`, so the click leaves the challenge first and then lowers the menu —
  leaveChallenge raises it again on its way past. Without that the only route
  back to a parked run was the challenge's own result screen, so opening the
  menu mid-challenge offered no way home but New game, which destroys the run.

  The return label reads the game behind the menu, never the session: an open
  room with no match started still has the solo run behind it, and reading the
  session there said "Back to match" over a roguelike it had not replaced. */
export function Menu() {
  const { runStarted, challenge, seats, parked } = useGameState();
  const dispatch = useDispatch();
  const net = useNet();
  const { t, locale, setLocale } = useI18n();
  /* The button shows the language you would switch to, not the current one —
     the same convention the rail's own langbtn uses. */
  const other = locale === "fi" ? "en" : "fi";
  const solo = challenge === null && seats.filter((s) => s === "human").length === 1;
  const parkedSolo = challenge !== null && parked !== null;
  const canContinue = runStarted && (solo || parkedSolo);
  const back =
    challenge === "rummikub"
      ? "menu.returnChallenge"
      : challenge !== null
        ? "menu.returnMatch"
        : "menu.returnGame";

  return (
    <Overlay>
      <h2>{t("menu.title")}</h2>
      <p className="dek">{t("menu.dek")}</p>
      <div className="menubtns">
        <div className="menugroup">
          {canContinue && (
            <MoveButton
              className="btn"
              disabled={net.live}
              onClick={() => {
                if (parkedSolo) dispatch({ type: "leaveChallenge" });
                dispatch({ type: "closeMenu" });
              }}
            >
              {t("btn.continue")}
            </MoveButton>
          )}
          {/* One click, one view, and no run destroyed on the way: the chair
              table opens on the plan New game has always produced — me at my
              own chair, the game at the other three — so Start is the second
              and last click to the felt. The confirmation moved with the
              destructive click and is raised by that Start, not here. */}
          <MoveButton className="btn" onClick={() => dispatch({ type: "showMenu", view: "lobby" })}>
            {t("btn.newGame")}
          </MoveButton>
          {/* Start-versus-join is not the single-player-versus-multiplayer
              split the lobby removed: a game you are joining is somebody
              else's table, and a join route hidden behind a button labelled
              New game would be undiscoverable. */}
          <MoveButton
            className="btn ghost"
            onClick={() => dispatch({ type: "showMenu", view: "join" })}
          >
            {t("btn.joinGame")}
          </MoveButton>
          {canContinue && net.live && <p className="dek">{t("menu.soloOnly")}</p>}
        </div>
        <div className="menugroup">
          {runStarted && !solo && (
            <button className="btn" onClick={() => dispatch({ type: "closeMenu" })}>
              {t(back)}
            </button>
          )}
          {/* Closed while a session is live, and the reason is a stall rather
              than tidiness. What is behind this button is Tuppi-Rummikub, which
              is dispatched with no seat table at all and so builds the
              single-human board it has always had: a guest whose chair came back
              "ai" would have every dispatch refused and no error to show for it.
              The race no longer needs the door — the lobby's chairs are what
              seat it — so hanging up is only asked of the challenge that has no
              opinion about peers. */}
          <button
            className="btn ghost"
            disabled={net.live}
            onClick={() => dispatch({ type: "showMenu", view: "challenges" })}
          >
            {t("btn.challenges")}
          </button>
          {net.live && <p className="dek">{t("menu.noChallenge")}</p>}
        </div>
        <div className="menugroup">
          <button
            className="btn ghost"
            onClick={() => dispatch({ type: "openModal", modal: "rules" })}
          >
            {t("btn.rules")}
          </button>
          <ScoresButton />
          <button className="langbtn" title={LOCALE_NAMES[other]} onClick={() => setLocale(other)}>
            {LOCALE_NAMES[other]}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
