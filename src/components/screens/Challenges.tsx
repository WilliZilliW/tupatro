import { useDispatch } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";

/* The list of alternate rule sets, which is empty and says so. No challenge
   exists yet: this is the place a later one is put, and nothing in the game
   layer knows the word. */
export function Challenges() {
  const dispatch = useDispatch();
  const { t } = useI18n();

  return (
    <Overlay>
      <h2>{t("challenges.title")}</h2>
      <p className="dek">{t("challenges.empty")}</p>
      <div className="row">
        <button className="btn" onClick={() => dispatch({ type: "showMenu", view: "start" })}>
          {t("btn.back")}
        </button>
      </div>
    </Overlay>
  );
}
