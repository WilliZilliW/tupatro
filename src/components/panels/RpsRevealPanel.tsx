import { SM } from "../../game/constants";
import { useI18n } from "../../i18n/useI18n";

/* The decision is the hand below the felt, not a button here: a card is
   already a clickable control, and three card-shaped buttons in this panel
   as well would be two controls for one choice. What is left is the prose
   the decision needs — the suit-to-throw legend and the two clubs' rule —
   above the explanatory line, the rule that broke three times in
   #declpanel, .replacepick and LaydownPanel. */
export function RpsRevealPanel() {
  const { t } = useI18n();

  return (
    <>
      <h3>{t("rps.throwTitle")}</h3>
      <div className="ln">
        <span>{SM.H.g}</span>
        <b>{t("rps.throw.paper")}</b>
      </div>
      <div className="ln">
        <span>{SM.S.g}</span>
        <b>{t("rps.throw.rock")}</b>
      </div>
      <div className="ln">
        <span>{SM.D.g}</span>
        <b>{t("rps.throw.scissors")}</b>
      </div>
      <p className="fine">{t("rps.clubsRule")}</p>
      <p className="fine">{t("rps.throwHelp")}</p>
    </>
  );
}
