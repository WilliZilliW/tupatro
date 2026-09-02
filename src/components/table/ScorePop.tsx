import { useI18n } from "../../i18n/useI18n";
import type { Pop } from "../../game/types";

export function ScorePop({ pop }: { pop: Pop }) {
  const { t, fmt } = useI18n();
  const mult = Math.round(pop.mult * 10) / 10;

  return (
    <div className="pop go">
      <span className="ht">
        {pop.dodged && t("pop.dodged") + " · "}
        {t(`type.${pop.typeId}`)}
        {pop.times > 1 && " ×" + pop.times}
      </span>
      <span className="pill c">{pop.chips}</span>
      <span className="times">×</span>
      <span className="pill m">{mult}</span>
      <span className="times">=</span>
      <span className="eq">{fmt(pop.total)}</span>
    </div>
  );
}
