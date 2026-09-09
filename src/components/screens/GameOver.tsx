import { useState } from "react";
import { ANTES, teamOf } from "../../game/constants";
import { addScore, rowFor } from "../../game/scores";
import { ownerSeat } from "../../game/rules";
import { tuppiInfo } from "../../game/scoring";
import { readScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { MoveButton } from "../MoveButton";
import { Scoreboard } from "./Scoreboard";

export function GameOver() {
  const g = useGameState();
  const dispatch = useDispatch();
  const you = useViewSeat();
  const team = teamOf(you);
  const { t, fmt } = useI18n();
  /* The team is the viewer's side; the seat is the one whose wallet holds
     the jokers that pay for the multiplier. */
  const info = tuppiInfo(g, team, ownerSeat(g));
  const won = g.tricks[team];
  const lost = g.tricks[1 - team];
  /* React runs a child's effect before its parent's, so on the commit that
     first shows this screen the provider has not written the row yet and the
     run that just ended would be missing from its own board. Merging it here
     with the same pure function the writer uses cannot duplicate it: addScore
     collapses a row equal on everything but the timestamp. */
  const [at] = useState(() => Date.now());
  const rows = addScore(readScores(), rowFor(g, false, at));

  const why = g.sooliBust
    ? t("over.sooliBust")
    : g.mode === "rami" && won < 7
      ? t("over.ramiShort", { won })
      : g.mode === "nolo" && won > 6
        ? t("over.noloBust", { won })
        : t("over.thin", { mult: info.mult });

  const lines: Array<[string, string]> = [
    [t("over.ante"), `${g.ante}/${ANTES.length}`],
    [t("over.tricks"), `${won}–${lost}`],
    [t("over.best"), String(Math.max(g.bestAnte, g.ante))],
    [t("seed.label"), g.seed],
  ];

  return (
    <Overlay>
      <h2>{t("over.title")}</h2>
      <p className="dek">
        {t("over.summary", { score: fmt(g.blindScore), target: fmt(g.target) })} {why}{" "}
        {t("over.allDealsPlayed", { deals: g.blindDeals })}
      </p>
      {lines.map(([label, value]) => (
        <div className="cashline" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
      <Scoreboard rows={rows} />
      <div className="row" style={{ marginTop: 18 }}>
        <MoveButton className="btn" onClick={() => dispatch({ type: "newRun", seat: you })}>
          {t("btn.newGame")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() => dispatch({ type: "newRun", seed: g.seed, seat: you })}
        >
          {t("btn.replaySeed")}
        </MoveButton>
        <button
          className="btn ghost"
          onClick={() => dispatch({ type: "openModal", modal: "rules" })}
        >
          {t("btn.rules")}
        </button>
      </div>
    </Overlay>
  );
}
