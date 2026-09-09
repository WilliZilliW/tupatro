import { teamOf } from "../../game/constants";
import { leadSuit } from "../../game/rules";
import { useGameState } from "../../hooks/useGame";
import { useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";

/* One line on what is expected of the player. Every new phase belongs here. */
export function Hint() {
  const g = useGameState();
  const you = useViewSeat();
  const spectating = useSpectating();
  const { t, seatName } = useI18n();

  const text = (): string => {
    if (
      (g.challenge === "race" || g.challenge === "tuppi") &&
      (g.phase === "soolioffer" || g.phase === "sooligive" || g.phase === "sooliready") &&
      g.sooliSeat !== null &&
      (spectating || g.sooliSeat !== you || g.seats[you] !== "human")
    )
      return t("hint.sooliWait", {
        who: seatName(g.sooliSeat, spectating || g.seats[you] !== "human" ? null : you),
      });
    if (g.phase === "play" && g.turn === you) {
      const ls = leadSuit(g);
      if (ls)
        return t(g.mode === "nolo" ? "hint.followDodge" : "hint.followWin", {
          suit: t(`suit.${ls}`),
        });
      return t(g.mode === "nolo" ? "hint.leadLow" : "hint.lead");
    }
    if (g.phase === "play") return t("hint.thinking", { who: seatName(g.turn, you) });
    if (g.phase === "laydown")
      return g.layTurn === teamOf(you) ? t("hint.laydown") : t("hint.laydownWait");
    if (g.phase === "swap") return t("hint.swapPickSide");
    if (g.phase === "sooligive") return t("hint.sooliGive");
    if (g.phase === "sooliready") return t("hint.sooliStart");
    if (g.phase === "declare" || g.phase === "soolioffer") return t("hint.declare");
    return "";
  };

  return <div className="hint">{text()}</div>;
}
