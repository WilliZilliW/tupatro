import { useState } from "react";
import { addRpsScore, rpsRowFor, type RpsRow } from "../../game/scores";
import { readRpsScores } from "../../game/storage";
import { ownerTeam } from "../../game/rules";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet, useSpectating } from "../../hooks/useNet";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { MoveButton } from "../MoveButton";
import type { Screen } from "../../game/types";

/* The match is over, so this screen draws the board — the same named
   deviation from "markup only" that GameOver, Victory, ChallengeOver and
   RaceOver make, through game/storage.ts and nothing else.

   The row is merged in here as well as written by the provider, because
   React runs a child's effect before its parent's: on the commit that first
   shows this screen the board on disk does not have the match yet.
   addRpsScore collapses a row equal on everything but the timestamp, so it
   cannot duplicate. */
export function RpsOver({ screen }: { screen: Extract<Screen, { kind: "rpsover" }> }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const net = useNet();
  const spectating = useSpectating();
  const { t, fmt } = useI18n();
  const own = ownerTeam(g);
  const [at] = useState(() => Date.now());
  const rows = addRpsScore(readRpsScores(), rpsRowFor(g, at));

  return (
    <Overlay>
      <h2>{t("rpsOver.title")}</h2>
      <p className="dek">{t(RESULT_LINE[screen.result])}</p>
      <div className="cashline">
        <span>{t("rps.you")}</span>
        <b>{fmt(screen.wins[own])}</b>
      </div>
      <div className="cashline">
        <span>{t("rps.opponent")}</span>
        <b>{fmt(screen.wins[1 - own])}</b>
      </div>
      <div className="cashline">
        <span>{t("seed.label")}</span>
        <b>{g.seed}</b>
      </div>
      <RpsBoard rows={rows} />
      <div className="row" style={{ marginTop: 18 }}>
        <MoveButton className="btn" onClick={() => dispatch({ type: "startChallenge", id: "rps" })}>
          {t("btn.playAgain")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() => dispatch({ type: "startChallenge", id: "rps", seed: g.seed })}
        >
          {t("btn.replaySeed")}
        </MoveButton>
        {/* The parked main run comes back on this click, exactly as it does on
            ChallengeOver's and RaceOver's own copies. A live session can never
            actually reach this screen — the Single player door hangs one up
            before this mode is dispatchable at all, and this mode never
            reaches the lobby or the wire — so the hang-up here is defence in
            depth, written because two result screens that disagree about what
            their identical button does is the worse outcome. */}
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

/* The three results, each with its own line — a draw is a real outcome here
   and the only one in the project, so it is neither a win nor a loss and
   never reads as one. */
const RESULT_LINE = {
  won: "rpsOver.won",
  lost: "rpsOver.lost",
  drawn: "rpsOver.drawn",
} as const;

const RESULT_LABEL = { won: "score.won", lost: "score.lost", drawn: "score.drawn" } as const;

/* Rows in, markup out, like the other boards — its own component rather than
   a mode of RaceBoard or ChallengeBoard, because the row shape is a fourth
   one: no ante, no blind and no score at all, only the result and how the
   three rounds split. */
function RpsBoard({ rows }: { rows: RpsRow[] }) {
  const { t, fmt } = useI18n();

  return (
    <div className="scoreboard">
      <h3>{t("rpsScore.title")}</h3>
      {rows.length === 0 ? (
        <p className="dek">{t("score.empty")}</p>
      ) : (
        <div className="scoretable rpstable">
          <div className="scorehead">
            <span>{t("score.rank")}</span>
            <span>{t("seed.label")}</span>
            <span>{t("rpsScore.wins")}</span>
            <span>{t("rpsScore.losses")}</span>
            <span>{t("raceScore.result")}</span>
          </div>
          {rows.map((row, i) => (
            <div className="scorerow" key={`${row.seed}-${row.at}-${i}`}>
              <span className="srank">{i + 1}</span>
              <span className="sseed">{row.seed}</span>
              <span className="sante">{fmt(row.wins)}</span>
              <span className="sante">{fmt(row.losses)}</span>
              <span className={row.result === "won" ? "sres won" : "sres"}>
                {t(RESULT_LABEL[row.result])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
