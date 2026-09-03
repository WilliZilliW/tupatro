import { PARTIES } from "../../game/content";
import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";

/* The running support of every party. Fixed PARTIES order, never sorted by
   count: a list that reordered itself mid-deal would be unreadable. Zero rows
   stay in place, muted. */
export function SupportBox() {
  const { support } = useGameState();
  const { t, fmt, nameOf, descOf } = useI18n();

  return (
    <div className="plate">
      <div className="lbl">{t("rail.support")}</div>
      <div className="support">
        {PARTIES.map((p) => {
          const n = support[p.id] ?? 0;
          return (
            <div key={p.id} className={cx("supportrow", !n && "zero")} title={descOf(p)}>
              <span className="pbadge">{p.g}</span>
              <span className="pname">{nameOf(p)}</span>
              <span className="pnum">{fmt(n)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
