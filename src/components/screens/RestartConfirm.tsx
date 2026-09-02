import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

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
          {t("btn.continue")}
        </button>
      </div>
    </Overlay>
  );
}
