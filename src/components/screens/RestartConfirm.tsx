import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

/* Reached from the start menu alone, so cancelling returns to the menu and
   not to the run: the ghost button says Cancel, where "Continue" would be a
   promise the click does not keep.

   Confirming no longer destroys the run on its own click: it opens the lobby,
   where the seat is picked, and only the lobby's Start dispatches newRun. */
export function RestartConfirm() {
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("restart.title")}</h2>
      <p className="dek">{t("restart.body")}</p>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "showMenu", view: "lobby" })}>
          {t("btn.yesRestart")}
        </button>
        <button className="btn ghost" onClick={() => dispatch({ type: "closeModal" })}>
          {t("btn.cancel")}
        </button>
      </div>
    </Overlay>
  );
}
