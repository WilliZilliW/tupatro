import { useState } from "react";
import { CHALLENGES } from "../../game/content";
import { addChallengeScore, challengeRowFor } from "../../game/scores";
import { readChallengeScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { ChallengeBoard } from "./ChallengeBoard";

/* The run is over, so this screen draws the board — the same named deviation
   from "markup only" that GameOver and Victory make, through game/storage.ts
   and nothing else.

   The row is merged in here as well as written by the provider, because React
   runs a child's effect before its parent's: on the commit that first shows
   this screen the board on disk does not have the run yet. addChallengeScore
   collapses a row equal on everything but the timestamp, so it cannot
   duplicate. */
export function ChallengeOver({ score }: { score: number }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const { t, fmt, nameOf } = useI18n();
  const row = CHALLENGES.find((c) => c.id === g.challenge) ?? CHALLENGES[0];
  const [at] = useState(() => Date.now());
  const rows = addChallengeScore(readChallengeScores(row.id), challengeRowFor(g, at));

  return (
    <Overlay>
      <h2>{t("chalOver.title")}</h2>
      <p className="dek">{t("chalOver.summary", { name: nameOf(row) })}</p>
      <div className="cashline">
        <span>{t("chal.total")}</span>
        <b>{fmt(score)}</b>
      </div>
      <div className="cashline">
        <span>{t("seed.label")}</span>
        <b>{g.seed}</b>
      </div>
      <ChallengeBoard rows={rows} />
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn" onClick={() => dispatch({ type: "startChallenge", id: row.id })}>
          {t("btn.playAgain")}
        </button>
        <button
          className="btn ghost"
          onClick={() => dispatch({ type: "startChallenge", id: row.id, seed: g.seed })}
        >
          {t("btn.replaySeed")}
        </button>
        {/* The parked main run comes back on this click: this screen and
            RaceOver are the only two sites that dispatch leaveChallenge, and
            the menu no longer offers a way out at all. A challenge is
            therefore left when it is over, never mid-deal. */}
        <button className="btn ghost" onClick={() => dispatch({ type: "leaveChallenge" })}>
          {t("btn.backToRun")}
        </button>
      </div>
    </Overlay>
  );
}
