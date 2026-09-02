import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

export function Stats() {
  const { money, trickNo, dealsLeft } = useGameState();
  const { t } = useI18n();

  return (
    <div className="stats">
      <div className="stat money">
        <div className="lbl">{t("rail.money")}</div>
        <div className="v">${money}</div>
      </div>
      <div className="stat">
        <div className="lbl">{t("rail.trick")}</div>
        <div className="v">{Math.min(13, trickNo + 1)}/13</div>
      </div>
      <div className="stat">
        <div className="lbl">{t("rail.deals")}</div>
        <div className="v">{dealsLeft}</div>
      </div>
    </div>
  );
}
