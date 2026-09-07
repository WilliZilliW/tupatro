import { econOf } from "../../game/economy";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";

export function Stats() {
  const g = useGameState();
  const { trickNo, dealsLeft } = g;
  /* The purse of the seat looking at the rail, not "the run's": the wallet
     belongs to a seat now. */
  const { money } = econOf(g, useViewSeat());
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
