import { useState } from "react";
import { teamOf } from "../../game/constants";
import { CHALLENGES } from "../../game/content";
import { dealPoints } from "../../game/points";
import { dealScores } from "../../game/race";
import { addRaceScore, raceRowFor, type RaceRow } from "../../game/scores";
import { readRaceScores } from "../../game/storage";
import { useDispatch, useGameState } from "../../hooks/useGame";
import { useNet, useSpectating } from "../../hooks/useNet";
import { useViewSeat } from "../../hooks/useSeat";
import { useI18n } from "../../i18n/useI18n";
import { Overlay } from "../Overlay";
import { Rich } from "../Rich";
import { MoveButton } from "../MoveButton";
import { usePairLabels } from "../pairLabels";
import type { MatchId, Screen } from "../../game/types";

/* The match is over, so this screen draws the board — the same named deviation
   from "markup only" that GameOver, Victory and ChallengeOver make, through
   game/storage.ts and nothing else.

   The row is merged in here as well as written by the provider, because React
   runs a child's effect before its parent's: on the commit that first shows
   this screen the board on disk does not have the match yet. addRaceScore
   collapses a row equal on everything but the timestamp, so it cannot
   duplicate. */
export function RaceOver({ screen }: { screen: Extract<Screen, { kind: "raceover" }> }) {
  const g = useGameState();
  const dispatch = useDispatch();
  const team = teamOf(useViewSeat());
  const net = useNet();
  const spectating = useSpectating();
  const { t, fmt, nameOf } = useI18n();
  const [ours, theirs] = usePairLabels(team);
  const [at] = useState(() => Date.now());
  /* Both match modes end here, and the screen has to name the one it is
     drawing: the two scales are not the same number and the boards they file
     on are two keys. */
  const mode: MatchId = g.challenge === "tuppi" ? "tuppi" : "race";
  const row = CHALLENGES.find((c) => c.id === mode) ?? CHALLENGES[0];
  const rows = addRaceScore(readRaceScores(mode), raceRowFor(g, at));
  /* raceBase still holds the deal that ended the match — startDeal is what
     clears it — so the deciding deal can be shown rather than hidden behind
     the totals. dealPoints reads the trick counts, which stand until the next
     deal for the same reason. */
  const last = mode === "tuppi" ? dealPoints(g) : dealScores(g);

  const total = t("matchDeal.total");

  const lines: Array<[string, string]> = [
    [`${ours} · ${total}`, `${fmt(screen.scores[team])} / ${fmt(g.target)}`],
    [`${theirs} · ${total}`, `${fmt(screen.scores[1 - team])} / ${fmt(g.target)}`],
    [`${ours} · ${t("raceOver.lastDeal")}`, fmt(last[team])],
    [`${theirs} · ${t("raceOver.lastDeal")}`, fmt(last[1 - team])],
    [t("raceOver.deals"), fmt(screen.deals)],
    [t("seed.label"), g.seed],
  ];

  return (
    <Overlay>
      <h2>{t("matchOver.title", { mode: nameOf(row) })}</h2>
      <p className="dek">
        {/* From a chair this is won or lost; the shared table is on neither
            side, so it names the pair that got there instead. */}
        <Rich
          text={
            spectating
              ? t("matchOver.wonBy", { who: screen.winner === team ? ours : theirs })
              : t(screen.winner === team ? "matchOver.won" : "matchOver.lost")
          }
        />
      </p>
      {lines.map(([label, value]) => (
        <div className="cashline" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
      <RaceBoard rows={rows} title={t("matchScore.title", { mode: nameOf(row) })} />
      <div className="row" style={{ marginTop: 18 }}>
        {/* Both replay the table this match was played at: the chairs are not
            saved anywhere — a race is never saved at all — so the state's own
            seats are what they carry, and over the wire they are a flow action
            like any other, so every peer rebuilds the same race. */}
        <MoveButton
          className="btn"
          onClick={() => dispatch({ type: "startChallenge", id: mode, seats: g.seats })}
        >
          {t("btn.playAgain")}
        </MoveButton>
        <MoveButton
          className="btn ghost"
          onClick={() =>
            dispatch({ type: "startChallenge", id: mode, seed: g.seed, seats: g.seats })
          }
        >
          {t("btn.replaySeed")}
        </MoveButton>
        {/* The parked main run comes back on this click: this screen and
            ChallengeOver are the two result screens that dispatch
            leaveChallenge, and the match is therefore left when it is over
            rather than handed back mid-match. `Menu`'s Continue is the third
            and last site — the only route back to a parked run before a result
            exists — and it is `disabled={net.live}`, so it cannot be clicked
            inside a session and needs no hang-up of its own. That `disabled` is
            load-bearing for this fix as well as for the menu's scope rule.

            The hang-up is not a courtesy, it is what makes the action local.
            The parked run this restores is *this window's own*, so there is no
            shared answer to broadcast — and a window that went back to its own
            roguelike while still sequencing would number its own run's ticks
            into a race the others are still playing. Hanging up first also
            routes the dispatch below straight to the reducer, since `send`
            reads the role synchronously.

            What the peers left behind are told depends on who clicked, and the
            asymmetry is the relay's rather than this button's: a host hanging
            up closes every link, so each of them raises `dropped`. A guest's
            hang-up reaches the host in a room only, and reaches the other
            guests not at all — the host broadcasts no `bye` and no guest ever
            messages another, so their match simply stops on a chair `g.seats`
            still calls "human". Telling them more is a transport increment and
            is in Known gaps. */}
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
      {/* Said before the click rather than after it, and not on the shared
          table: that window draws no such button at all. */}
      {net.live && !spectating && <p className="dek">{t("net.leaveHangsUp")}</p>}
    </Overlay>
  );
}

/* Rows in, markup out, like Scoreboard and ChallengeBoard — and a third
   component rather than a mode of either, because the row shape is a third
   one: a race has no ante and no blind, and unlike a challenge it can be lost
   and is sorted on the fewest deals.

   It borrows the main board's six-column `.scoretable` grid rather than
   growing a stylesheet of its own, so the deal count sits in the narrow
   numeric slot the ante uses and the blind's wider slot is left empty — the
   same empty `<span />` the main board's head row already ends with. */
function RaceBoard({ rows, title }: { rows: RaceRow[]; title: string }) {
  const { t, fmt } = useI18n();

  return (
    <div className="scoreboard">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="dek">{t("score.empty")}</p>
      ) : (
        <div className="scoretable">
          <div className="scorehead">
            <span>{t("score.rank")}</span>
            <span>{t("seed.label")}</span>
            <span>{t("raceScore.deals")}</span>
            <span />
            <span>{t("score.points")}</span>
            <span>{t("raceScore.result")}</span>
          </div>
          {rows.map((row, i) => (
            <div className="scorerow" key={`${row.seed}-${row.at}-${i}`}>
              <span className="srank">{i + 1}</span>
              <span className="sseed">{row.seed}</span>
              <span className="sante">{fmt(row.deals)}</span>
              <span />
              <span className="spts">{fmt(row.score)}</span>
              <span className={row.won ? "sres won" : "sres"}>
                {t(row.won ? "score.won" : "score.lost")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
