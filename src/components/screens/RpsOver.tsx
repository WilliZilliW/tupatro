import { useState } from "react";
import { teamOf } from "../../game/constants";
import { addRpsScore, rpsRowFor, type RpsRow } from "../../game/scores";
import { readRpsScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet, useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { MoveButton } from "../MoveButton";
import { useRpsLabels } from "../pairLabels";
import type { Screen } from "../../game/types";

/* One map for both readers: the screen's own result line and the board's
   result column. A drawn match reads as a draw in both, which is the whole
   reason rpsWinner returns "draw" rather than null. */
const RESULT_KEY = {
  won: "rpsOver.won",
  lost: "rpsOver.lost",
  drawn: "rpsOver.drawn",
} as const;

const BOARD_KEY = { won: "score.won", lost: "score.lost", drawn: "score.drawn" } as const;

/* The match is over, so this screen draws the board — the same named
   deviation from "markup only" that GameOver, Victory, ChallengeOver and
   RaceOver make, through game/storage.ts and nothing else.

   The row is merged in here as well as written by the provider, because
   React runs a child's effect before its parent's: on the commit that first
   shows this screen the board on disk does not have the match yet.
   addRpsScore collapses a row equal on everything but the timestamp, so it
   cannot duplicate — and it is not merged at all while a session is live,
   since the provider files nothing then and the row is the run owner's. */
export function RpsOver({ screen }: { screen: Extract<Screen, { kind: "rpsover" }> }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const net = useNet();
  const spectating = useSpectating();
  const { t, fmt } = useI18n();
  /* Viewer-relative, not the run owner's: the second human at rpsSeats(g)'s
     other chair need not own the run, so "won"/"lost" and which cashline
     reads "You" both have to come from the window's own seat rather than
     from ownerTeam(g). screen.winner itself is already team-indexed and
     viewer-blind — see showRpsOver's own comment. */
  const you = useViewSeat();
  const viewTeam = teamOf(you);
  const resultKey =
    screen.winner === "draw" ? "drawn" : screen.winner === viewTeam ? "won" : "lost";
  /* "You" and "Opponent" from a chair, the two playing characters' own names
     on a shared display — the same substitution the felt and the rail plate
     make, through the one hook all three share. */
  const [mineLabel, theirsLabel] = useRpsLabels(g, viewTeam);
  const [at] = useState(() => Date.now());
  /* The row is merged in only when the provider is actually going to file it.
     GameContext returns before every board write while a session is live, and
     rpsRowFor reads ownerTeam(g) rather than this window's own team — so
     merging it here would put the run owner's result and the run owner's two
     counts on the other player's board, directly under a headline read from
     that window's own seat. Filing a networked match for real needs the
     window's seat inside a pure scores function, which is the gap CLAUDE.md
     already records for the race. */
  const disk = readRpsScores();
  const rows = net.live ? disk : addRpsScore(disk, rpsRowFor(g, at));

  return (
    <Overlay>
      <h2>{t("rpsOver.title")}</h2>
      {/* Three results, not two: exactly RPS_ROUNDS rounds are played and a
          tied round counts for neither side, so equal wins is a drawn match —
          the first draw state in this project. From a chair it reads as won,
          lost or drawn; a shared display is on neither side, so it names the
          player who took the match instead, the same reading RaceOver's own
          matchOver.wonBy carries. A draw is already sideless in both. */}
      <p className="dek">
        {spectating && screen.winner !== "draw"
          ? t("rpsOver.wonBy", { who: screen.winner === viewTeam ? mineLabel : theirsLabel })
          : t(RESULT_KEY[resultKey])}
      </p>
      <div className="cashline">
        <span>{mineLabel}</span>
        <b>{fmt(screen.wins[viewTeam])}</b>
      </div>
      <div className="cashline">
        <span>{theirsLabel}</span>
        <b>{fmt(screen.wins[1 - viewTeam])}</b>
      </div>
      <div className="cashline">
        <span>{t("seed.label")}</span>
        <b>{g.seed}</b>
      </div>
      <RpsBoard rows={rows} />
      <div className="row" style={{ marginTop: 18 }}>
        {/* Both replay the table this match was played at, exactly as
            RaceOver's own pair do and for the identical reason: the chairs are
            never saved — this mode writes no snapshot at all — so the state's
            own seats are what they carry, and startChallenge is a `flow`
            action, so the host numbers it and every peer rebuilds the same
            two-player match. Dispatched without `seats`, startChallenge falls
            back to a single-human board: the run owner would play the Rng's
            own draw and the other person would sit at a chair g.seats calls
            "ai", clicking a twelve-card hand Hand.tsx silently drops. */}
        <MoveButton
          className="btn"
          onClick={() => dispatch({ type: "startChallenge", id: "rps", seats: g.seats })}
        >
          {t("btn.playAgain")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() =>
            dispatch({ type: "startChallenge", id: "rps", seed: g.seed, seats: g.seats })
          }
        >
          {t("btn.replaySeed")}
        </MoveButton>
        {/* The parked main run comes back on this click, exactly as it does on
            ChallengeOver's and RaceOver's own copies, and the hang-up is what
            makes the action local: a window that went back to its own
            roguelike while still sequencing would number its own run's ticks
            into a match the other player is still on. This mode reaches the
            lobby and the wire now, so a live session really can be here. */}
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

/* Rows in, markup out, like the other boards — its own component rather than
   a mode of RaceBoard or ChallengeBoard, because the row shape is a fourth
   one: no ante, no blind and no score at all, only the result and the two
   round counts it came from. */
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
                {t(BOARD_KEY[row.result])}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
