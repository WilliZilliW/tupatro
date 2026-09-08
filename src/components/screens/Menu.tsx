import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";

/* The first thing a visit sees, and where the rail's New game button leads.
   Continue only lowers the menu: the boot path has already rehydrated the
   saved run into the store, so there is nothing left to read back. */
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
        <button
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
        </button>
        {/* The only site that dispatches leaveChallenge: the parked main run
            comes back exactly, mid-deal included. */}
        {challenge !== null && (
          <button className="btn ghost" onClick={() => dispatch({ type: "leaveChallenge" })}>
            {t("btn.leaveChallenge")}
          </button>
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
            than tidiness: startChallenge rebuilds `seats` from scratch —
            `humans` seats clockwise from the parked run's owner — so it knows
            nothing about which chairs peers are actually sitting in. A guest
            whose chair came back "ai" would have every dispatch refused and no
            error to show for it. Hanging up first is the honest route, and a
            challenge that is aware of a session is the transport's next
            increment, not this one's. */}
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
