import { leadSuit } from "../../game/rules";
import { useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";

/* One line on what is expected of the player. Every new phase belongs here. */
export function Hint() {
  const g = useGameState();
  const { t, seatName } = useI18n();

  const text = (): string => {
    if (g.phase === "play" && g.turn === 0) {
      const ls = leadSuit(g);
      if (ls)
        return t(g.mode === "nolo" ? "hint.followDodge" : "hint.followWin", {
          suit: t(`suit.${ls}`),
        });
      return t(g.mode === "nolo" ? "hint.leadLow" : "hint.lead");
    }
    if (g.phase === "play") return t("hint.thinking", { who: seatName(g.turn) });
    if (g.phase === "swap") return t(g.swapPick ? "hint.swapPickHand" : "hint.swapPickSide");
    if (g.phase === "sooligive") return t("hint.sooliGive");
    if (g.phase === "sooliready") return t("hint.sooliStart");
    if (g.phase === "declare" || g.phase === "soolioffer") return t("hint.declare");
    return "";
  };

  return <div className="hint">{text()}</div>;
}
