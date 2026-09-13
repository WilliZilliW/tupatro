import { useDispatch } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";

/* Raised by the lobby's Start alone, and only for the roguelike: newRun
   destroys the run behind the menu where startChallenge parks it, so the two
   match modes need no confirmation at all. Cancelling therefore returns to the
   lobby the click came from — the ghost button says Cancel, where "Continue"
   would be a promise it does not keep.

   Confirming is the destructive click, and it goes through the session rather
   than dispatching: net.start() is the one site that turns the lobby's chairs
   and its mode into an action, so the chair plan cannot be lost between the
   picker and the run. Offline that is the reducer's own dispatch. */
export function RestartConfirm() {
  const dispatch = useDispatch();
  const net = useNet();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("restart.title")}</h2>
      <p className="dek">{t("restart.body")}</p>
      <div className="row">
        {/* A MoveButton for the same reason the seed dialog's two are: every
            modal is a local action away, so no screen may hold a live newRun
            that a table window could click. */}
        <MoveButton className="btn" onClick={() => net.start()}>
          {t("btn.yesRestart")}
        </MoveButton>
        <button className="btn ghost" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.cancel")}
        </button>
      </div>
    </Overlay>
  );
}
