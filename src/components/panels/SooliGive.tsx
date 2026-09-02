import { useI18n } from "../../i18n/useI18n";
import { Rich } from "../Rich";

/* Tuppi: the sooli player gives their partner one card and gets one back
   blind. Which card to give is the player's choice, not the game's — which is
   why this is a visible step and not an automatic draw. */
export function SooliGive() {
  const { t } = useI18n();
  return (
    <>
      <h3>{t("sooliGive.title")}</h3>
      <div className="ln">
        <span>{t("sooliGive.pick")}</span>
        <b>{t("sooliGive.blind")}</b>
      </div>
      <p className="fine">
        <Rich text={t("sooliGive.fine")} />
      </p>
    </>
  );
}
