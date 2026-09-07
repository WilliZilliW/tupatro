import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { ScoresButton } from "./ScoresModal";

/* The first thing a visit sees, and where the rail's New game button leads.
   Continue only lowers the menu: the boot path has already rehydrated the
   saved run into the store, so there is nothing left to read back. */
export function Menu() {
  const { runStarted, challenge } = useGameState();
  const dispatch = useDispatch();
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
        <button
          className="btn ghost"
          onClick={() => dispatch({ type: "showMenu", view: "challenges" })}
        >
          {t("btn.challenges")}
        </button>
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
