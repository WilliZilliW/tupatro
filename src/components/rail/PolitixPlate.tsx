import { CHALLENGES, PX_PARTIES } from "../../game/content";
import { useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";

/* The whole rail of a Politix game in one plate: the turn, the viewer's hand
   and the three parties' voter-card totals. Per-group detail is the felt's. */
export function PolitixPlate() {
  const g = useGameState();
  const you = useViewSeat();
  const { t, fmt, nameOf } = useI18n();
  const row = CHALLENGES.find((c) => c.id === "politix") ?? CHALLENGES[0];
  const px = g.politix;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

  return (
    <div className="plate chalplate">
      <div className="lbl">{nameOf(row)}</div>
      <div className="chalrowline">
        <span>{t("px.round", { n: fmt((px?.turnNo ?? 0) + 1) })}</span>
        <b>{t("px.hand", { n: fmt(px?.hands[you].length ?? 0) })}</b>
      </div>
      {PX_PARTIES.map((id) => (
        <div className="chalrowline" key={id}>
          <span>{t(`px.party.${id}`)}</span>
          <b>{fmt(px ? sum(px.collected[id]) : 0)}</b>
        </div>
      ))}
    </div>
  );
}
