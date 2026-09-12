import { useState } from "react";
import { CHALLENGES } from "../../game/content";
import { addChallengeScore, challengeRowFor } from "../../game/scores";
import { readChallengeScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet, useSpectating } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { ChallengeBoard } from "./ChallengeBoard";
import { MoveButton } from "../MoveButton";

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
  const net = useNet();
  const spectating = useSpectating();
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
        <MoveButton
          className="btn"
          onClick={() => dispatch({ type: "startChallenge", id: row.id })}
        >
          {t("btn.playAgain")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() => dispatch({ type: "startChallenge", id: row.id, seed: g.seed })}
        >
          {t("btn.replaySeed")}
        </MoveButton>
        {/* The parked main run comes back on this click: this screen and
            RaceOver are the two result screens that dispatch leaveChallenge,
            so a challenge is left when it is over rather than handed back
            mid-deal. `Menu`'s Continue is the third and last site, the only
            route back to a parked run before a result exists, and it is
            `disabled={net.live}` — unreachable in a session, and so needing no
            hang-up of its own.

            Tuppi-Rummikub cannot be started while a session is live — Menu's
            Challenges button is disabled for it — so the hang-up here is
            defence in depth, written because two result screens that disagree
            about what their identical button does is the worse outcome. The
            reason it is needed at all is on RaceOver's own copy. */}
        <MoveButton
          className="btn ghost"
          onClick={() => {
            if (net.live) net.hangUp();
            dispatch({ type: "leaveChallenge" });
          }}
        >
          {t("btn.backToRun")}
        </MoveButton>
      </div>
      {net.live && !spectating && <p className="dek">{t("net.leaveHangsUp")}</p>}
    </Overlay>
  );
}
