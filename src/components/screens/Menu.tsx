import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";

/* The first thing a visit sees, and where the rail's New game button leads.
   Continue only lowers the menu: the boot path has already rehydrated the
   saved run into the store, so there is nothing left to read back.

   The shared table can be standing here with the session still live, and not
   only by its own hand: `leaveChallenge` is a `flow` action, so the host
   clicking Leave lands *every* peer on this menu. New game and Leave are
   MoveButtons for that reason — the rail's New game button is not drawn on a
   table, but this menu is not reached through the rail alone. The other six
   buttons stay ordinary because all six are `local`: Continue, Rules and
   SCORES; Host game and Join game, which are also how a host or a guest
   reaches a hang-up; and Challenges, which raises the list rather than
   starting anything. Challenges is `disabled={net.live}` as well, for the
   stall its own comment describes — so it is not the `local` scope alone that
   keeps a session out of Tuppi-Rummikub, and that door must not be opened
   without reading what is behind it. */
export function Menu() {
  const { runStarted, challenge } = useGameState();
  const dispatch = useDispatch();
  const net = useNet();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("menu.title")}</h2>
      <p className="dek">{t("menu.dek")}</p>
      <div className="menubtns">
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
        {/* The only site that dispatches leaveChallenge: the parked main run
            comes back exactly, mid-deal included. */}
        {challenge !== null && (
          <MoveButton className="btn ghost" onClick={() => dispatch({ type: "leaveChallenge" })}>
            {t("btn.leaveChallenge")}
          </MoveButton>
        )}
        {/* The two doors to the lobby. New Game above is untouched: it still
            starts a single-player run at seat 0 with nothing in the way. */}
        <button className="btn ghost" onClick={() => dispatch({ type: "showMenu", view: "lobby" })}>
          {t("btn.hostGame")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "showMenu", view: "join" })}>
          {t("btn.joinGame")}
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
        <button
          className="btn ghost"
          onClick={() => dispatch({ type: "openModal", modal: "rules" })}
        >
          {t("btn.rules")}
        </button>
        <ScoresButton />
      </div>
    </Overlay>
  );
}
