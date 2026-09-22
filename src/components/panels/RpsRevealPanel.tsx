import { SM } from "../../game/constants";
import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

/* The decision is the hand below the felt, not a button here: a card is
   already a clickable control, and three card-shaped buttons in this panel
   as well would be two controls for one choice. What is left is the prose
   the decision needs — the suit-to-throw legend and the honours' rule —
   above the explanatory line, the rule that broke three times in
   #declpanel, .replacepick and LaydownPanel.

   The legend and the rules are drawn once, on the very first round, and not
   again: this panel remounts every time the phase returns to rpsthrow, so
   without the gate the whole explanation would reappear round after round —
   read once at the start of a twelve-round match, not eleven more times.
   The title stays every round, since the panel would otherwise read as
   empty on rounds two and up. */
export function RpsRevealPanel() {
  const g = useGameState();
  const { t } = useI18n();
  const first = g.rpsRound === 0;

  return (
    <>
      <h3>{t("rps.throwTitle")}</h3>
      {first && (
        <>
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
          <div className="ln">
            <span>{SM.C.g}</span>
            <b>{t("rps.throw.foil")}</b>
          </div>
          <p className="fine">{t("rps.foilRule")}</p>
          <p className="fine">{t("rps.clubsRule")}</p>
          <p className="fine">{t("rps.sofiaRule")}</p>
          <p className="fine">{t("rps.throwHelp")}</p>
        </>
      )}
    </>
  );
}
