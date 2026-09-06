import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

/* Reached from the start menu alone, so cancelling returns to the menu and
   not to the run: the ghost button says Cancel, where "Continue" would be a
   promise the click does not keep. */
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
