import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

/* Reached from the start menu alone, so cancelling returns to the menu and
   not to the run: the ghost button says Cancel, where "Continue" would be a
   promise the click does not keep.

   Confirming is the destructive click: it dispatches newRun itself, so the
   run behind the menu is gone the moment it lands. That is the whole reason
   the dialog exists, and why it is raised only when there is a run to lose. */
export function RestartConfirm() {
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("restart.title")}</h2>
      <p className="dek">{t("restart.body")}</p>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "newRun" })}>
          {t("btn.yesRestart")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.cancel")}
        </button>
      </div>
    </Overlay>
  );
}
