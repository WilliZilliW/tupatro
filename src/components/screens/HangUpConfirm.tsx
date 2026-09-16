import { useDispatch } from "../../hooks/useGame";
import { useNet } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { MoveButton } from "../MoveButton";
import { Overlay } from "../Overlay";

/* Raised by the start menu's Single player button while a session is live —
   the door that used to be `disabled` now asks this instead. Confirming ends
   the session before the single-player screen opens: net.hangUp() runs first,
   synchronously, so the two dispatches that follow (closeModal, then
   showMenu "single") reach the reducer with this window already off the
   session. showMenu does not clear g.modal on its own, which is why both
   dispatches are needed rather than one.

   The confirm button is a MoveButton for the same reason the door it replaces
   is: the screen it opens holds the only resumeGame dispatch and the third
   leaveChallenge dispatch, so no live control may reach it. A table never
   sees this dialog at all — MoveButton renders nothing while spectating — but
   the confirm still carries the guard as defence in depth, the same reasoning
   SeedDialog's and RestartConfirm's confirm buttons use.

   Cancelling dispatches only closeModal: g.menu is still "start" underneath,
   so the state afterwards is exactly the state before the dialog opened, and
   no net method is called. */
export function HangUpConfirm() {
  const dispatch = useDispatch();
  const net = useNet();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("hangup.title")}</h2>
      <p className="dek">{t("hangup.body")}</p>
      {net.role === "host" && <p className="dek">{t("hangup.hostBody")}</p>}
      <div className="row">
        <MoveButton
          className="btn"
          onClick={() => {
            net.hangUp();
            dispatch({ type: "closeModal" });
            dispatch({ type: "showMenu", view: "single" });
          }}
        >
          {t("btn.yesHangUp")}
        </MoveButton>
        <button className="btn ghost" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.cancel")}
        </button>
      </div>
    </Overlay>
  );
}
