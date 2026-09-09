import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";

/* The first thing a visit sees, and where the rail's New game button leads.
   Continue only lowers the menu: the boot path has already rehydrated the
   saved run into the store, so there is nothing left to read back.

   Six buttons in three groups: the run, the ways to play with other people or
   against a different rule set, and the two things a player reads rather than
   plays. The groups are divs inside the one .menubtns column, so
   ".menubtns button" still matches every button in DOM order.

   The shared table can be standing here with the session still live, and not
   only by its own hand: `leaveChallenge` is a `flow` action, so the host
   clicking Back to your run lands *every* peer on this menu. New game is a
   MoveButton for that reason — the rail's New game button is not drawn on a
   table, but this menu is not reached through the rail alone. The other five
   buttons stay ordinary because all five are `local`: Continue, Rules and
   SCORES; Multiplayer, which is also how a host or a guest reaches a hang-up;
   and Challenges, which raises the list rather than starting anything.
   Challenges is `disabled={net.live}` as well, for the stall its own comment
   describes — so it is not the `local` scope alone that keeps a session out of
   Tuppi-Rummikub, and that door must not be opened without reading what is
   behind it. */
export function Menu() {
  const { runStarted } = useGameState();
  const dispatch = useDispatch();
  const net = useNet();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("menu.title")}</h2>
      <p className="dek">{t("menu.dek")}</p>
      <div className="menubtns">
        <div className="menugroup">
          {runStarted && (
            <button className="btn" onClick={() => dispatch({ type: "closeMenu" })}>
              {t("btn.continue")}
            </button>
          )}
          <MoveButton
            className="btn"
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
        </div>
        <div className="menugroup">
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
