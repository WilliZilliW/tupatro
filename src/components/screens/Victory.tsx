import { useState } from "react";
import { econOf } from "../../game/economy";
import { addScore, rowFor } from "../../game/scores";
import { readScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { Scoreboard } from "./Scoreboard";

export function Victory() {
  const g = useGameState();
  const { seed } = g;
  const you = useViewSeat();
  const { money, jokers } = econOf(g, you);
  const dispatch = useDispatch();
  const { t, nameOf } = useI18n();
  /* Same reason as on the game-over screen: the provider's effect runs after
     this child's render, so the won run is merged in here to be on its own
     board straight away. addScore makes the merge idempotent. */
  const [at] = useState(() => Date.now());
  const rows = addScore(readScores(), rowFor(g, true, at));

  return (
    <Overlay>
      <h2>{t("win.title")}</h2>
      <p className="dek">{t("win.body")}</p>
      <div className="cashline">
        <span>{t("cash.bank")}</span>
        <b>${money}</b>
      </div>
      <div className="cashline">
        <span>{t("win.jokers")}</span>
        <b>{jokers.map((j) => nameOf(j)).join(", ") || "–"}</b>
      </div>
      <div className="cashline">
        <span>{t("seed.label")}</span>
        <b>{seed}</b>
      </div>
      <Scoreboard rows={rows} />
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn gold" onClick={() => dispatch({ type: "newRun", seat: you })}>
          {t("btn.newGame")}
        </button>
      </div>
    </Overlay>
  );
}
