import { teamOf } from "../../game/constants";
import { ownerSeat } from "../../game/rules";
import { tuppiInfo } from "../../game/scoring";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { MoveButton } from "../MoveButton";
import { ScoresButton } from "./ScoresModal";
import type { Screen } from "../../game/types";

type CashOutScreen = Extract<Screen, { kind: "cashout" }>;

/* The rewards are already in the state (cashOut in the reducer). This screen
   only reports the breakdown, so a redraw cannot pay out twice. */
export function CashOut({ screen }: { screen: CashOutScreen }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const team = teamOf(useViewSeat());
  const { t, fmt } = useI18n();
  /* The team is the viewer's side; the seat is the one whose wallet holds
     the jokers that pay for the multiplier. */
  const info = tuppiInfo(g, team, ownerSeat(g));

  const bonusKey = g.sooli
    ? "cash.sooliBonus"
    : g.mode === "rami"
      ? "cash.overTricks"
      : "cash.underTricks";

  const lines: Array<[string, string]> = [
    [t("cash.reward"), "$" + screen.reward],
    [t(bonusKey), "$" + screen.bonus],
    [t("cash.spareDeals"), "$" + screen.spare],
    [t("cash.interest"), "$" + screen.interest],
  ];

  return (
    <Overlay>
      <h2>{t(g.sooli ? "cash.sooli" : g.mode === "rami" ? "cash.rami" : "cash.nolo")}</h2>
      <p className="dek">
        {t("cash.summary", {
          score: fmt(g.blindScore),
          target: fmt(g.target),
          last: fmt(screen.score),
          us: g.tricks[team],
          them: g.tricks[1 - team],
          mult: info.mult,
        })}
      </p>
      {lines.map(([label, value]) => (
        <div className="cashline" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
      <div className="cashtot">
        <span>{t("cash.bank")}</span>
        <b>${screen.bank}</b>
      </div>
      <div className="row" style={{ marginTop: 18 }}>
        <MoveButton className="btn gold" onClick={() => dispatch({ type: "toShop" })}>
          {t("btn.toShop")}
        </MoveButton>
        <ScoresButton />
      </div>
    </Overlay>
  );
}
