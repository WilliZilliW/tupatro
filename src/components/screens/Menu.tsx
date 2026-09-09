import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";

/* Continue and New game belong to the solo roguelike, so both are disabled
  while a session is live: newRun is a flow action that would replace every
  peer's game, and resuming a run the room has not started is the same window
  walking out of the session it is still in.

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
  const { t } = useI18n();
  const solo = challenge === null && seats.filter((s) => s === "human").length === 1;
  const parkedSolo = challenge !== null && parked !== null;
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
          {runStarted && (solo || parkedSolo) && (
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
          <MoveButton
            className="btn"
            disabled={net.live}
            onClick={() =>
              /* A run to come back to is a run that would be lost, and that is
                 exactly when the confirmation is worth a click. With nothing to
                 lose the run starts here, at seat 0: single player is seat 0 by
                 definition, and a picker in the way is a decision the player
                 never asked to make. The bare newRun carries no seat, so a
                 lobby-era save seated elsewhere cannot propagate into the fresh
                 run. */
              runStarted
                ? dispatch({ type: "openModal", modal: "restart" })
                : dispatch({ type: "newRun" })
            }
          >
            {t("btn.newGame")}
          </MoveButton>
          {net.live && <p className="dek">{t("menu.soloOnly")}</p>}
        </div>
        <div className="menugroup">
          {runStarted && !solo && (
            <button className="btn" onClick={() => dispatch({ type: "closeMenu" })}>
              {t(back)}
            </button>
          )}
          {/* The one door to everything about other people: hosting, joining
              and hanging up all live behind it. Never disabled — it is the
              only route to Hang up, so shutting it while a session is live
              would trap the player in the session. */}
          <button
            className="btn ghost"
            onClick={() => dispatch({ type: "showMenu", view: "multi" })}
          >
            {t("btn.multiplayer")}
          </button>
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
        </div>
      </div>
    </Overlay>
  );
}
