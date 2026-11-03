import { teamOf } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { usePairLabels } from "../pairLabels";

/* The whole rail of a Politix game in one plate: the turn, the viewer's hand
   and the two parties' voter-card totals. Per-group detail is the felt's. */
export function PolitixPlate() {
  const g = useGameState();
  const you = useViewSeat();
  const team = teamOf(you);
  const { t, fmt, nameOf } = useI18n();
  const row = CHALLENGES.find((c) => c.id === "politix") ?? CHALLENGES[0];
  const [mine, theirs] = usePairLabels(team);
  const px = g.politix;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

  return (
    <div className="plate chalplate">
      <div className="lbl">{nameOf(row)}</div>
      <div className="chalrowline">
        <span>{t("px.round", { n: fmt((px?.turnNo ?? 0) + 1) })}</span>
        <b>{t("px.hand", { n: fmt(px?.hands[you].length ?? 0) })}</b>
      </div>
      <div className="chalrowline">
        <span>{mine}</span>
        <b>{fmt(px ? sum(px.collected[team]) : 0)}</b>
      </div>
      <div className="chalrowline">
        <span>{theirs}</span>
        <b>{fmt(px ? sum(px.collected[1 - team]) : 0)}</b>
      </div>
    </div>
  );
}
