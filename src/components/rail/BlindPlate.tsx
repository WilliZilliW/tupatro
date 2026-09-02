import { BLIND_KEYS, BLIND_MARKS } from "../../game/constants";
import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

export function BlindPlate() {
  const { blindIdx, boss } = useGameState();
  const { t, nameOf, descOf } = useI18n();

  return (
    <div className="plate">
      <div className="blindplate">
        <div className={`blindmark bm-${blindIdx}`}>{BLIND_MARKS[blindIdx]}</div>
        <div>
          <div className="lbl">
            {blindIdx === 2 ? t("rail.boss") : t("rail.blindN", { n: blindIdx + 1 })}
          </div>
          <div className="blindname">{boss ? nameOf(boss) : t(BLIND_KEYS[blindIdx])}</div>
        </div>
      </div>
      {boss && <div className="bossnote">{descOf(boss)}</div>}
    </div>
  );
}
