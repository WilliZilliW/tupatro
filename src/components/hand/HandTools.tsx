import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { cx } from "../cx";
import type { SortMode } from "../../game/types";

export function HandTools() {
  const { hands, customOrder, sortMode } = useGameState();
  const dispatch = useDispatch();
  const you = useViewSeat();
  const { t } = useI18n();

  if (!hands[you].length) return <div className="handtools" />;

  const modes: Array<{ mode: SortMode; label: string }> = [
    { mode: "suit", label: t("hand.bySuit") },
    { mode: "rank", label: t("hand.byRank") },
  ];

  return (
    <div className="handtools">
      <span className="tip">{t("hand.order")}</span>
      {modes.map(({ mode, label }) => (
        <button
          key={mode}
          className={cx("sortbtn", !customOrder && sortMode === mode && "on")}
          onClick={() => dispatch({ type: "setSortMode", p: you, mode })}
        >
          {label}
        </button>
      ))}
      <span className="tip">{t(customOrder ? "hand.customOrder" : "hand.dragHint")}</span>
    </div>
  );
}
