import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";

/* Continue belongs to the solo roguelike, not whichever game happens to be
  behind the menu. Other modes still need a local way to lower the overlay.
  New game must stay offline: newRun is a flow action and would otherwise
  replace every peer's match with a shared roguelike. */
export function Menu() {
  const { runStarted, challenge, seats } = useGameState();
  const dispatch = useDispatch();
  const net = useNet();
  const { t } = useI18n();
  const solo = !net.live && challenge === null && seats.filter((s) => s === "human").length === 1;

  return (
    <Overlay>
      <h2>{t("menu.title")}</h2>
      <p className="dek">{t("menu.dek")}</p>
      <div className="menubtns">
        <div className="menugroup">
          {runStarted && solo && (
            <button className="btn" onClick={() => dispatch({ type: "closeMenu" })}>
              {t("btn.continue")}
            </button>
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
              {t(challenge === "rummikub" ? "menu.returnChallenge" : "menu.returnMatch")}
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
